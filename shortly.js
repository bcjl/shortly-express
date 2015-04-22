var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcryptjs');
var knex = require('knex')
var passport = require('passport');
var GitHubStrategy = require('passport-github').Strategy;

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: 'thisbesecret',
  saveUnitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
})

passport.use(new GitHubStrategy({
    clientID: '67b15a2f1e142c230a6e',
    clientSecret: '19566e10f1b84f349d422c2214ac36cfbc4e61da',
    callbackURL: "http://localhost:4568/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    process.nextTick(function(){
      return done(null, profile)
    })
  }
));


app.get('/',
    function(req, res) {
      util.checkUser(req, res, function(){
        res.render('index');
      });
    });

app.get('/login',
  function(req, res){
    res.render('login');
  });

app.get('/create',
function(req, res) {
  util.checkUser(req, res, function(){
    res.render('index');
  });
});

app.get('/links',
function(req, res) {
  util.checkUser(req, res, function(){
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
    });
  });
});

app.get('/signup',
  function(req, res){
    res.render('signup');
  });

app.get('/logout',
  function(req, res){
    req.session.destroy(function(){
      res.redirect('/')
    });

  });

app.post('/links',
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

app.get('/github',
  passport.authenticate('github'),
  function(req, res){
});

app.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
    function(req, res) {
      req.session.user = req.user;
      res.redirect('/');
  });
/************************************************************/
// Write your authentication routes here
/************************************************************/

app.post( '/signup',
  function(req, res){
    var username = req.body.username;
    var password = req.body.password;

    new User ({username: req.body.username, })
      .fetch()
      .then(function(found){
        if(found){
          console.log('username taken: ', req.body.username);
          res.redirect('/signup');
        } else {
        // Store hash in your password DB.
              var user = new User ({
                username: username,
                password: password,
              });

              user.save().then(function(newUser){
                req.session.user = newUser.get('username');
                res.redirect('/');
              });
        }
      },
      function(err){
        console.log(err);
      });
  });

app.post('/login',
  function(req,res){
    new User({'username' : req.body.username})
      .fetch()
      .then(function(found){
        if(!found){
          res.redirect('/login');
        } else {
          found.passwordCompare(req.body.password, function(match){
            console.log(match)
            if (match){
              req.session.user= found.get('username');
              console.log(req.session.user)
              res.redirect('/');
            } else {
              res.redirect ('/login');
            }
          });
        }
      });

  });

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
