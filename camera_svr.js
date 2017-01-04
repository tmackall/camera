"use strict";
const async = require('async');
const http = require('http');
const request = require('request');
const recursive = require('recursive-readdir');
const path = require('path');
const fs = require('fs');
const url = require('url');
const os = require( 'os' );
const winston = require('winston');


const LL = process.env.LL || process.env.npm_package_config_ll || 'warning';
const PORT = process.env.PORT || process.env.npm_package_config_port || '3000';
const PORT_DB = process.env.PORT_DB || process.env.npm_package_config_port_db || '3002';
const IP_DB = process.env.IP_DB || process.env.npm_package_config_ip_db || '192.168.0.21';
const RE_IMAGE = /.*image-cam.*\.jpg/;
const RE_SWITCH = /.*switch.*/;
const PIC_STORE = '/pics';
const DB_COLLECTION = 'db/movement';

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({'timestamp':true, level: LL})
   ]
});

var STATE_SERVER = 'on';

// -------------------------------
// 
// zipFiles() 
//  - zips up a list of files.
//
// -------------------------------
function zipFiles(files, callback) {
  let fileZip = path.join(DIR_ZIP, new Date().toISOString() + '.zip');
  let output = fs.createWriteStream(fileZip);
  let zipArchive = archiver('zip');

  output.on('close', function() {
    logger.info(zipArchive.pointer() + ' total bytes');
    logger.info('%s created', fileZip);
    callback();
  });

  zipArchive.on('error', function(err) {
      throw err;
  });
  zipArchive.pipe(output);
  zipArchive.bulk([{src: files,  expand: true}]);
  zipArchive.finalize();
}

// ------------------------------------------------
//
// dbNotification() 
//  - log the
//    movement into the database.
//
// ------------------------------------------------
function dbNotification(callback) {

  request.post(
    'http://' + IP_DB + ':' + PORT_DB + '/' + DB_COLLECTION,
    function (error, response, body) {
      if (error) {
        logger.error(error);
      }
      callback(error);
  });


}


// --------------------------------------------------
//
// cleanUp() 
//  - deletes all files in the storage area
//
// --------------------------------------------------
function cleanUp(location, callb) {
  var cList = [];
  async.series([
    // jpg's - check for them
    function(cb) {
      cList = [];
      recursive(location, function(err, res) {
        if (err) return callb(err), cb(err);
        if (res.length === 0) {
          logger.info('no files to cleanup');
          return callb(null), cb(res);
        }
        res.forEach(function(file) {
          if (file == /.*\.jpg/) {
            cList.push(path.join(location, file));
          }
        });
        cList = res;
        logger.info('Num files to cleanup: ' + cList.length);
        cb();
      });
    },
    // pics - zip them
    function(cb) {
      zipFiles(cList, function(err) {
        cb(err);
      });
    },
    // del - files in capture area
    function(cb) {
      rmFileList(cList, function(err) {
        if (err) return callb(err), cb(err);
        cb();
      });
    },
    function(cb) {
      callb(null, null);
      cb();
    },
  ]);
}

// ------------------------------------------
//
// camera-svr
//   - service that receives an http request
//   from the camera indicating movement. 
//   - receives jpg/images from the camera 
//   that it stores.
//
// ------------------------------------------
var server = http.createServer(requestProcess);

function requestProcess(request, response) {
  var headers = request.headers;
  var method = request.method;
  var url = request.url;
  var body = [];
  var valRet = {};

  response.statusCode = 200;
  request.on('error', function(err) {
    logger.error(err);
    valRet.text = err;
  }).on('data', function(chunk) {
    body.push(chunk);
  }).on('end', function() {
    body = Buffer.concat(body);
    response.on('error', function(err) {
      logger.error(err);
      valRet.text = err;
    });

    // movement - log movement in the database
    if (url == '/camera/notification' &&  method == 'GET') {
      logger.info('movement notification: %s', url);
      
      // notification - store in DB to be handled later
      dbNotification(function(err) {
        logger.error(err);
      });

    // images - store the jpg files
    } else if (RE_IMAGE.test(url) && method == 'PUT' &&
      STATE_SERVER == 'on') {
      
      logger.debug('Image received: %s', url);
      var localFile = path.join(PIC_STORE, path.basename(url));

      // dir - pics dir create if necessary
      fs.mkdir(PIC_STORE, function(err) {
        // jpgs - write to dir
        fs.writeFile(localFile, body, 'binary', function(err){
          if (err) throw err;
        });
      });

    // notifications (email) - turn on and off here
    } else if (RE_SWITCH.test(url) && method == 'PUT') {
      if (/.*\/on.*/i.test(url)) {
        STATE_SERVER = 'on';
      } else {
        STATE_SERVER = 'off';
      }
      valRet.state = STATE_SERVER;
      logger.info('switch command: %s', STATE_SERVER);
      cleanUp(PIC_STORE, function(err, res) {
        if (err) {
          logger.error(err);
        }
      });

    // notification status - get it
    } else if (RE_SWITCH.test(url) && method == 'GET') {
      valRet.push(STATE_SERVER);
      logger.info('state: %s', STATE_SERVER);

    } else {
      response.statusCode = 404;
    }

    response.setHeader('Content-Type', 'application/json');
    valRet.status = response.statusCode;

    var responseBody = {
      method: method,
      data: valRet,
      url: url,
    };

    response.write(JSON.stringify(responseBody));
    response.end();

  });
}
server.listen(PORT);
