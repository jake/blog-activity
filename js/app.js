Date.prototype.getDOY = function() {
    var jan_first = new Date(this.getFullYear(), 0, 1);
    return Math.ceil((this - jan_first) / 86400000);
}

function number_with_commas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

var API = {
    base:   "http://api.tumblr.com/v2",
    key:    'hFPxFhhjbogV6ZuGLyagswAcL1A0I3CSkFVdIYtZHV6E90Yojx',

    date_cutoff: 0,

    blogs_count: 0,
    counts: {},

    show_results_timeout: false,
    
    log: function(msg)
    {
        $('#log').prepend(msg + "\n");
        return msg;
    },

    midnight: function(date)
    {
        var timestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return timestamp / 1;
    },

    days: function()
    {
        return $('#days').val();
    },

    days_ago: function(days)
    {
        var date = new Date();
        date.setDate(date.getDate() - days);
        return date;
    },

    failure: function(reason)
    {
        $('#submit').removeAttr('disabled');
        alert(API.log('API error' + (reason ? (': ' + reason) : '')));
    },
    
    loading: function()
    {
        $('#submit').attr('disabled', 'disabled');

        $('#show_results').hide();
        window.clearTimeout(API.show_results);
        API.show_results = window.setTimeout(function(){
            $('#show_results').show();
        }, 10000);

        $('#results').hide();

        $('#log').text('');
        $('#log').parents('.row').show();

        $('#loading').show();
    },

    try_done: function(force)
    {
        if (! force && Object.keys(API.counts).length < API.blogs_count) return;

        window.clearTimeout(API.show_results);

        API.display_results();

        $('#submit').removeAttr('disabled');
        $('#results').show();

        $('#loading').hide();
    },

    toggle_blog_columns: function()
    {
        if ($('.blog_column:hidden').length) {
            API.show_blog_columns();
        } else {
            API.hide_blog_columns();
        }
    },

    hide_blog_columns: function()
    {
        $('.blog_column').hide();
        $('#toggle_blog_columns').text('Show blogs');
    },

    show_blog_columns: function()
    {
        $('.blog_column').show();
        $('#toggle_blog_columns').text('Hide blogs');
    },

    display_results: function()
    {
        API.log('Displaying results');

        $('#results').html($('#results-template').html());

        var days = {};

        for (var i = 0; i < API.days(); i++) {
            days[API.midnight(API.days_ago(i))] = {};
        }

        $(Object.keys(API.counts)).each(function(i, blog){
            $('#results-head').append(
                $('<th/>').attr({
                    'width': 140,
                    'class': 'blog_column',
                }).text(blog)
            );

            for (day in days) {
                if (typeof API.counts[blog].days[day] == 'undefined') {
                    days[day][blog] = {
                        notes: 0,
                        posts: 0,
                    };
                } else {
                    days[day][blog] = API.counts[blog].days[day];
                }
            }
        });

        $('#results-head').append(
            $('<th/>').attr('width', 140).html('Total (<a href="#" id="toggle_blog_columns" onclick="API.toggle_blog_columns(); return false;">Hide blogs</a>)')
        );


        var days_ago = 0;

        for (day in days) {
            var row = $('<tr/>');

            var total = {
                notes: 0,
                posts: 0,
            }

            row.append($('<td/>').text(
                API.days_ago(days_ago++).toDateString()
            ));

            for (blog in days[day]) {
                var html = '<span class="muted">&mdash;</span>';
                var info = days[day][blog];

                total.notes += info.notes;
                total.posts += info.posts;

                if (info.posts) {
                    html = number_with_commas(info.notes) + ' <em class="muted">(' + info.posts + ' post' + (info.posts != 1 ? 's' : '') + ')</em>';
                }

                row.append($('<td/>').attr({
                    'class': 'blog_column',
                }).html(html));
            }

            html = '<span class="muted">&mdash;</span>';

            if (total.posts) {
                html = number_with_commas(total.notes) + ' <em class="muted">(' + total.posts + ' post' + (total.posts != 1 ? 's' : '') + ')</em>'
            }

            row.append($('<td/>').html(html));

            $('#results-body').append(row);
        }

        if (API.blogs_count > 4) {
            API.hide_blog_columns();
        }
    },

    load: function(blog, offset)
    {
        if (typeof offset == 'undefined') {
            offset = 0;
        }

        API.log('Querying ' + blog + ' at offset ' + offset);

        $.getScript(
            API.base + '/blog/' + blog + '/posts?jsonp=API.callback&reblog_info=true&limit=50&offset=' + offset + '&api_key=' + API.key
        );
    },
    
    aggregate: function(blog, posts)
    {
        API.log('Processing posts for ' + blog);

        if (typeof API.counts[blog] == 'undefined') {
            API.counts[blog] = {
                meta: {
                    offset: 0,
                },
                days: {},
            };
        }

        var last_day = 0;

        $(posts).each(function(i, post){
            if (post.reblogged_from_id) {
                // API.log('Skipping reblog on ' + blog);
                return;
            }

            var date = new Date(post.timestamp * 1000);
            var day = API.midnight(date);

            last_day = day;

            if (day <= API.date_cutoff) {
                API.log('Reached day cutoff for ' + blog + ' @ post ' + post.id);
                return false;
            }

            if (post.note_count) {
                if (typeof API.counts[blog]['days'][day] == 'undefined') {
                    API.counts[blog]['days'][day] = {
                        date: date.toDateString(),
                        notes: 0,
                        posts: 0,
                    };
                }

                API.counts[blog]['days'][day]['posts'] += 1;
                API.counts[blog]['days'][day]['notes'] += post.note_count;
            } else {
                API.log('No note_count found for ' + blog + ' @ post ' + post.id);
            }
        });

        if (last_day > API.date_cutoff) {
            API.log('Haven\'t reached date cutoff yet for ' + blog);
            API.counts[blog]['meta']['offset'] += 50;
            API.load(blog + '.tumblr.com', API.counts[blog]['meta']['offset']);
        } else {
            API.try_done();
        }
    },

    callback: function(data)
    {
        if (data && data.meta && data.meta.status == 200) {
            API.aggregate(data.response.blog.name, data.response.posts);
        } else {
            if (data.meta.status == 404) {
                API.log('Skipping invalid blog');
                API.blogs_count--;
                API.try_done();
            } else {
                API.failure(data.meta.msg);
            }
        }
    }
};

API.date_cutoff = API.days_ago(API.days()) / 1;

$('#days').on('change', function(){
    API.date_cutoff = API.days_ago(API.days()) / 1;
});

$('#show_results_button').on('click', function(){
    $('#show_results').hide();
    API.try_done(true);
});

$('#submit').on('click', function(){
    API.loading();

    API.show_blog_columns();

    // Reset data
    API.blogs_count = 0;
    API.counts = {};

    var dupes = {};

    $($('#blogs').val().split("\n")).each(function(i, val){
        val = val.trim();
        val = val.replace('http://', '');
        val = val.replace('https://', '');
        val = val.replace(/(\/|\?)(.*)/g, '')

        if (! val) return;

        if (val.indexOf('.') === -1) {
            val = val + '.tumblr.com';
        }

        if (! dupes[val]) {
            dupes[val] = true;
        } else {
            API.log('Skipping dupe ' + val);
            return;
        }

        API.blogs_count++;
        API.load(val);
    });

    if (! API.blogs_count) API.try_done();
});