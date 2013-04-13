Date.prototype.getDOY = function() {
    var jan_first = new Date(this.getFullYear(), 0, 1);
    return Math.ceil((this - jan_first) / 86400000);
}

var API = {
    base:   "http://api.tumblr.com/v2",
    key:    'hFPxFhhjbogV6ZuGLyagswAcL1A0I3CSkFVdIYtZHV6E90Yojx',

    blogs: [],
    counts: {},
    
    log: function(msg) {
        $('#log').append(msg + "\n");
        return msg;
    },

    midnight: function(date){
        var timestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return timestamp / 1;
    },

    days_ago: function(days){
        var date = new Date();
        date.setDate(date.getDate() - days);
        return date;
    },

    failure: function(reason)
    {
        alert(API.log('API error' + (reason ? (': ' + reason) : '')));
    },
    
    loading: function()
    {
        $('#submit').attr('disabled', 'disabled');
        $('#results').hide();

        $('#log').text('');
        $('#log').parents('.row').show();

        $('#loading').show();
    },

    try_done: function()
    {
        if (Object.keys(API.counts).length < API.blogs.length) return;

        API.display_results();

        $('#submit').removeAttr('disabled');
        $('#results').show();

        $('#loading').hide();
    },

    display_results: function()
    {
        API.log('Displaying results');
        $('#results').text(JSON.stringify(API.counts, null, 4));
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
    
    aggregate: function(blog, posts){
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
                API.log('Reached day cutoff on ' + blog + ' @ ' + post.id);
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
                API.log('No note_count found for ' + blog + ' @ ' + post.id);
            }
        });

        if (last_day > API.date_cutoff) {
            API.log('Haven\'t reached date cutoff yet on ' + blog);
            API.counts[blog]['meta']['offset'] += 50;
            API.load(blog + '.tumblr.com', API.counts[blog]['meta']['offset']);
        } else {
            API.try_done();
        }
    },

    callback: function(data)
    {
        if (data && data.meta && data.meta.status == 200 && data.response.posts && data.response.posts.length) {
            API.aggregate(data.response.blog.name, data.response.posts);
        } else {
            API.failure();
        }
    }
};

API.date_cutoff = API.days_ago(10) / 1;

$('#submit').on('click', function(){
    API.loading();

    // Reset data
    API.counts = {};

    $($('#blogs').val().split("\n")).each(function(i, val){
        val = val.trim();
        val = val.replace('http://', '');
        val = val.replace(/\/$/, '');

        if (! val) return;

        if (val.indexOf('.') === -1) {
            val = val + '.tumblr.com';
        }

        API.blogs.push(val);
        API.load(val);
    });
});