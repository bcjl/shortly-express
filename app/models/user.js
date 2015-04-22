var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,

  initialize: function(){
    this.on('creating', this.passwordHash);
  },

  passwordHash: function(){
    var promiseHash = Promise.promisify(bcrypt.hash);

    return promiseHash(this.get('password'), null, null).bind(this)
      .then(function(hash){
        this.set('password', hash);
      });

  },

  passwordCompare: function(userPW, callback){
    bcrypt.compare(userPW, this.get('password'), function(err, matched){
      callback(matched);
    });
  }
});

module.exports = User;
