// Example from resumable github
let fs = require('fs'), path = require('path'), util = require('util'), Stream = require('stream').Stream;

module.exports = resumable = function (temporaryFolder) {
  let $ = this;
  $.temporaryFolder = temporaryFolder;
  $.maxFileSize = null;
  $.fileParameterName = 'file';

  try {
    fs.mkdirSync($.temporaryFolder);
  } catch (e) {
  }


  let cleanIdentifier = function (identifier) {
    return identifier.replace(/^0-9A-Za-z_-/img, '');
  };

  let getChunkFilename = function (chunkNumber, identifier) {
    // Clean up the identifier
    identifier = cleanIdentifier(identifier);
    // What would the file name be?
    return path.join($.temporaryFolder, './resumable-' + identifier + '.' + chunkNumber);
  };

  let validateRequest = function (chunkNumber, chunkSize, totalSize, identifier, filename, fileSize) {
    // Clean up the identifier
    identifier = cleanIdentifier(identifier);

    // Check if the request is sane
    if (chunkNumber == 0 || chunkSize == 0 || totalSize == 0 || identifier.length == 0 || filename.length == 0) {
      return 'non_resumable_request';
    }
    let numberOfChunks = Math.max(Math.floor(totalSize / (chunkSize * 1.0)), 1);
    if (chunkNumber > numberOfChunks) {
      return 'invalid_resumable_request1';
    }

    // Is the file too big?
    if ($.maxFileSize && totalSize > $.maxFileSize) {
      return 'invalid_resumable_request2';
    }

    if (typeof(fileSize) != 'undefined') {
      if (chunkNumber < numberOfChunks && fileSize != chunkSize) {
        // The chunk in the POST request isn't the correct size
        return 'invalid_resumable_request3';
      }
      if (numberOfChunks > 1 && chunkNumber == numberOfChunks && fileSize != ((totalSize % chunkSize) + chunkSize)) {
        // The chunks in the POST is the last one, and the fil is not the correct size
        return 'invalid_resumable_request4';
      }
      if (numberOfChunks == 1 && fileSize != totalSize) {
        // The file is only a single chunk, and the data size does not fit
        return 'invalid_resumable_request5';
      }
    }

    return 'valid';
  };

  //'found', filename, original_filename, identifier
  //'not_found', null, null, null
  $.get = function (req, callback) {
    let chunkNumber = req.param('resumableChunkNumber', 0);
    let chunkSize = req.param('resumableChunkSize', 0);
    let totalSize = req.param('resumableTotalSize', 0);
    let identifier = req.param('resumableIdentifier', "");
    let filename = req.param('resumableFilename', "");

    if (validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename) == 'valid') {
      let chunkFilename = getChunkFilename(chunkNumber, identifier);
      fs.exists(chunkFilename, function (exists) {
        if (exists) {
          callback('found', chunkFilename, filename, identifier);
        } else {
          callback('not_found', null, null, null);
        }
      });
    } else {
      callback('not_found', null, null, null);
    }
  };

  //'partly_done', filename, original_filename, identifier
  //'done', filename, original_filename, identifier
  //'invalid_resumable_request', null, null, null
  //'non_resumable_request', null, null, null
  $.post = function (req, callback) {

    let fields = req.body;
    let files = req.files;

    let chunkNumber = fields['resumableChunkNumber'];
    let chunkSize = fields['resumableChunkSize'];
    let totalSize = fields['resumableTotalSize'];
    let identifier = cleanIdentifier(fields['resumableIdentifier']);
    let filename = fields['resumableFilename'];

    let original_filename = fields['resumableIdentifier'];

    if (!files[$.fileParameterName] || !files[$.fileParameterName].size) {
      callback('invalid_resumable_request', null, null, null);
      return;
    }
    let validation = validateRequest(chunkNumber, chunkSize, totalSize, identifier, files[$.fileParameterName].size);
    if (validation == 'valid') {
      let chunkFilename = getChunkFilename(chunkNumber, identifier);
      // Save the chunk (TODO: OVERWRITE)
      fs.rename(files[$.fileParameterName].path, chunkFilename, function () {
        // Do we have all the chunks?
        let currentTestChunk = 1;
        let numberOfChunks = Math.max(Math.floor(totalSize / (chunkSize * 1.0)), 1);
        let testChunkExists = function () {
          fs.exists(getChunkFilename(currentTestChunk, identifier), function (exists) {
            if (exists) {
              currentTestChunk++;
              if (currentTestChunk > numberOfChunks) {
                callback('done', filename, original_filename, identifier);
              } else {
                // Recursion
                testChunkExists();
              }
            } else {
              callback('partly_done', filename, original_filename, identifier);
            }
          });
        };
        testChunkExists();
      });
    } else {
      callback(validation, filename, original_filename, identifier);
    }
  };


  // Pipe chunks directly in to an existsing WritableStream
  //   r.write(identifier, response);
  //   r.write(identifier, response, {end:false});
  //
  //   let stream = fs.createWriteStream(filename);
  //   r.write(identifier, stream);
  //   stream.on('data', function(data){...});
  //   stream.on('end', function(){...});
  $.write = function (identifier, writableStream, options) {
    console.log('here write');
    options = options || {};
    options.end = (typeof options['end'] == 'undefined' ? true : options['end']);

    // Iterate over each chunk
    let pipeChunk = function (number) {
      console.log(`write ${number}`);
      let chunkFilename = getChunkFilename(number, identifier);
      fs.exists(chunkFilename, function (exists) {
        console.log(chunkFilename);
        if (exists) {
          // If the chunk with the current number exists,
          // then create a ReadStream from the file
          // and pipe it to the specified writableStream.
          let sourceStream = fs.createReadStream(chunkFilename);
          sourceStream.pipe(writableStream, {
            end: false
          });
          sourceStream.on('end', function () {
            // When the chunk is fully streamed,
            // jump to the next one
            pipeChunk(number + 1);
          });
        } else {
          // When all the chunks have been piped, end the stream
          if (options.end) writableStream.end();
          if (options.onDone) options.onDone();
        }
      });
    };
    pipeChunk(1);
  };


  $.clean = function (identifier, options) {
    options = options || {};
    // Iterate over each chunk
    let pipeChunkRm = function (number) {
      let chunkFilename = getChunkFilename(number, identifier);
      //console.log('removing pipeChunkRm ', number, 'chunkFilename', chunkFilename);
      fs.exists(chunkFilename, function (exists) {
        if (exists) {
          // console.log('exist removing ', chunkFilename);
          fs.unlink(chunkFilename, function (err) {
            if (err && options.onError) options.onError(err);
          });
          pipeChunkRm(number + 1);
        } else {
          if (options.onDone) options.onDone();
        }
      });
    };
    pipeChunkRm(1);
  };

  return $;
};