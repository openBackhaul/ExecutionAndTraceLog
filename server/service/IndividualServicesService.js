'use strict';


/**
 * Initiates process of embedding a new release
 *
 * body V1_bequeathyourdataanddie_body 
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * no response value expected for this operation
 **/
exports.bequeathYourDataAndDie = function(body,user,originator,xCorrelator,traceIndicator,customerJourney) {
  return new Promise(function(resolve, reject) {
    resolve();
  });
}


/**
 * Removes application from list of targets of subscriptions for service requests
 *
 * body V1_disregardapplication_body 
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * no response value expected for this operation
 **/
exports.disregardApplication = function(body,user,originator,xCorrelator,traceIndicator,customerJourney) {
  return new Promise(function(resolve, reject) {
    resolve();
  });
}


/**
 * Provides list of applications that are requested to send service request notifications
 *
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * returns List
 **/
exports.listApplications = function(user,originator,xCorrelator,traceIndicator,customerJourney) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = [ {
  "application-name" : "RegistryOffice",
  "application-release-number" : "0.0.1",
  "application-address" : "10.118.125.157",
  "application-port" : 1000
}, {
  "application-name" : "TypeApprovalRegister",
  "application-release-number" : "0.0.1",
  "application-address" : "10.118.125.157",
  "application-port" : 1001
} ];
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}


/**
 * Provides list of recorded service requests
 *
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * returns List
 **/
exports.listRecords = function(user,originator,xCorrelator,traceIndicator,customerJourney) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = [ {
  "x-correlator" : "550e8400-e29b-11d4-a716-446655440000",
  "trace-indicator" : "1.1",
  "user" : "User Name",
  "originator" : "Resolver",
  "application-name" : "CurrentController",
  "operation-name" : "/v1/provide-current-controller",
  "response-code" : 200,
  "timestamp" : "2010-11-20T14:00:00+01:00",
  "stringified-body" : "{}",
  "stringified-response" : "{\"current-controller\": \"10.118.125.157:8443\"}"
}, {
  "x-correlator" : "883e8400-e29b-11d4-a716-446655440333",
  "trace-indicator" : "1",
  "user" : "User Name",
  "originator" : "x:akta",
  "application-name" : "RegistryOffice",
  "operation-name" : "/v1/update-approval-status",
  "response-code" : 401,
  "timestamp" : "",
  "stringified-body" : "",
  "stringified-response" : ""
} ];
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}


/**
 * Provides list of service request records belonging to the same flow
 *
 * body V1_listrecordsofflow_body 
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * returns List
 **/
exports.listRecordsOfFlow = function(body,user,originator,xCorrelator,traceIndicator,customerJourney) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = [ {
  "x-correlator" : "550e8400-e29b-11d4-a716-446655440000",
  "trace-indicator" : "1.1",
  "user" : "User Name",
  "originator" : "Resolver",
  "application-name" : "CurrentController",
  "operation-name" : "/v1/provide-current-controller",
  "response-code" : 200,
  "timestamp" : "2010-11-20T14:00:00+01:00",
  "stringified-body" : "{}",
  "stringified-response" : "{\"current-controller\": \"10.118.125.157:8443\"}"
}, {
  "x-correlator" : "550e8400-e29b-11d4-a716-446655440000",
  "trace-indicator" : "1",
  "user" : "User Name",
  "originator" : "x:akta",
  "application-name" : "Resolver",
  "operation-name" : "/v1/resolve-get-request",
  "response-code" : 200,
  "timestamp" : "2010-11-20T14:00:00+01:04",
  "stringified-body" : "{\"uri\"=\"https://[CurrentController/v1/provide-current-controller]/rests/data/network-topology:network-topology/topology=topology-netconf/node=305251234/yang-ext:mount/core-model-1-4:control-construct/logical-termination-point=[Connector2LtpUuid/v1/provide-ltp-uuid(305251234,305551234)]/layer-protocol=[Connector2LtpUuid/v1/provide-lp-lid(305251234,305551234)]/air-interface-2-0:air-interface-pac/air-interface-configuration/mimo-is-on\"}",
  "stringified-response" : "{\"uri\"=\"https://10.118.125.157:8443/rests/data/network-topology:network-topology/topology=topology-netconf/node=513250011/yang-ext:mount/core-model-1-4:control-construct/logical-termination-point=RF-2146697857/layer-protocol=2146697857/air-interface-2-0:air-interface-pac/air-interface-configuration/mimo-is-on\"}"
} ];
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}


/**
 * Provides list of unsuccessful service requests
 *
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * returns List
 **/
exports.listRecordsOfUnsuccessful = function(user,originator,xCorrelator,traceIndicator,customerJourney) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = [ {
  "x-correlator" : "883e8400-e29b-11d4-a716-446655440333",
  "trace-indicator" : "1",
  "user" : "User Name",
  "originator" : "x:akta",
  "application-name" : "RegistryOffice",
  "operation-name" : "/v1/update-approval-status",
  "response-code" : 401,
  "timestamp" : "",
  "stringified-body" : "",
  "stringified-response" : ""
} ];
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}


/**
 * Records a service request
 *
 * body ServiceRequestRecord 
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * no response value expected for this operation
 **/
exports.recordServiceRequest = function(body,user,originator,xCorrelator,traceIndicator,customerJourney) {
  return new Promise(function(resolve, reject) {
    resolve();
  });
}


/**
 * Adds to the list of applications
 *
 * body V1_regardapplication_body 
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * no response value expected for this operation
 **/
exports.regardApplication = function(body,user,originator,xCorrelator,traceIndicator,customerJourney) {
  return new Promise(function(resolve, reject) {
    resolve();
  });
}


/**
 * Starts application in generic representation
 *
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * returns inline_response_200
 **/
exports.startApplicationInGenericRepresentation = function(user,originator,xCorrelator,traceIndicator,customerJourney) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
  "consequent-action-list" : [ {
    "label" : "Inform about Application",
    "request" : "https://10.118.125.157:1002/v1/inform-about-application-in-generic-representation"
  } ],
  "response-value-list" : [ {
    "field-name" : "applicationName",
    "value" : "OwnApplicationName",
    "datatype" : "String"
  } ]
};
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}

