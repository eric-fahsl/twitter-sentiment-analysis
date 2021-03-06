declare let require: any;

let Twitter = require('twitter');
let sentiment = require('sentiment');
let swearJar = require('swearjar');
let API = require('./api-management.json');
let elasticsearch = require('elasticsearch');

let esClient = new elasticsearch.Client({
  host: 'localhost:9200',
  log: 'error'
});

function loadIntoEs(obj) {
  if (esClient) {
      esClient.create({
      index: 'twitter3',
      type: 'tweet',
      body: obj
    }, function (error, response) {
      if (error) {
        console.log('elasticsearch error: ' + error);
        esClient = null;
      }
    });
  }
}

  export class TwitterStream {

    public client: any;
    private emitter: any;
    private streamingTerm: string;

    constructor(_emitter: any) {
      this.streamingTerm = API.streaming_term;
      this.emitter = _emitter;
      this.client = new Twitter(API);
      this.stream();
    }

    private stream() {
      this.client.stream('statuses/filter', { track: this.streamingTerm }, (stream) => {
        stream.on('data', (tweet) => {
          //console.log([tweet.text, new Date()]);
          tweet['sentiment'] = sentiment(tweet.text);
          tweet['created_at'] = new Date();
          tweet.topic = this.cleanTopic(this.streamingTerm);
          if (swearJar.profane(tweet.text)) {
            tweet.text = swearJar.censor(tweet.text);
          }
          this.emitter.notifyTweet(tweet);
          loadIntoEs(tweet);
          //epoch_millis | getTime()
        });

        stream.on('error', function (error) {
          console.log(error);
        });
      });
    }

    private cleanTopic(topic) {
      topic = topic.split(',')[0];
      topic = topic.charAt(0).toUpperCase() + topic.slice(1);
      return topic;
    }

  }
