var unirest = require('unirest');
var express = require('express');
var events = require('events');

var getFromApi = function(endpoint, args) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/' + endpoint)
           .qs(args)
           .end(function(response) {
                if (response.ok) {
                    emitter.emit('end', response.body);
                }
                else {
                    emitter.emit('error', response.code);
                }
            });
    return emitter;
};

var app = express();
app.use(express.static('public'));

app.get('/search/:name', function(req, res) {
    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });

    searchReq.on('end', function(item) {
        var artist = item.artists.items[0];

        // Get related artists
        var relatedEndpoint = 'artists/' + artist.id + '/related-artists'
        var relatedReq = getFromApi(relatedEndpoint);

        relatedReq.on('end', function(item) {
          artist.related = item.artists;

          var numCompleted = 0;
          var numRelArtists = artist.related.length;

          var checkComplete = function() {
            if (numCompleted === numRelArtists) {
              res.json(artist);
            }
          }

          artist.related.map(function(relArtist, i, relArtists) {
            var topTracksEndpoint = 'artists/' + relArtist.id + '/top-tracks';
            var topTracksReq = getFromApi(topTracksEndpoint, {
                country: 'US'
            });

            topTracksReq.on('end', function(item) {
              relArtists[i].tracks = item.tracks;
              numCompleted++;
              checkComplete();
            });

            topTracksReq.on('error', function(error) {
              relArtists[i].tracks = "Error: " + error;
              numCompleted++;
              checkComplete();
            });

          });
        })

        relatedReq.on('error', function(err) {
          artist.related = item.artists;
          res.status(404).send('related artists not found');
        })

    });

    searchReq.on('error', function(code) {
        res.sendStatus(code);
    });
});

app.listen(8080);
