'use strict';


/**
 * Returns entire record of a service request
 *
 * uuid String 
 * returns inline_response_200_8
 **/
exports.getServiceRecordProfileCapability = function(uuid) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
  "service-record-profile-1-0:service-record-profile-capability" : {
    "application-name" : "application-name",
    "response-code" : 0,
    "operation-name" : "operation-name",
    "stringified-response" : "stringified-response",
    "originator" : "originator",
    "stringified-body" : "stringified-body",
    "trace-indicator" : "trace-indicator",
    "user" : "user",
    "x-correlator" : "x-correlator",
    "timestamp" : "timestamp"
  }
};
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}

