'use strict';

const LogicalTerminatinPointConfigurationInput = require('onf-core-model-ap/applicationPattern/onfModel/services/models/logicalTerminationPoint/ConfigurationInput');
const LogicalTerminationPointService = require('onf-core-model-ap/applicationPattern/onfModel/services/LogicalTerminationPointServices');

const ForwardingConfigurationService = require('onf-core-model-ap/applicationPattern/onfModel/services/ForwardingConstructConfigurationServices');
const ForwardingAutomationService = require('onf-core-model-ap/applicationPattern/onfModel/services/ForwardingConstructAutomationServices');
const prepareForwardingConfiguration = require('./individualServices/PrepareForwardingConfiguration');
const prepareForwardingAutomation = require('./individualServices/PrepareForwardingAutomation');

const httpServerInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/HttpServerInterface');
const httpClientInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/HttpClientInterface');

const onfAttributeFormatter = require('onf-core-model-ap/applicationPattern/onfModel/utility/OnfAttributeFormatter');

const onfAttributes = require('onf-core-model-ap/applicationPattern/onfModel/constants/OnfAttributes');

const logicalTerminationPoint = require('onf-core-model-ap/applicationPattern/onfModel/models/LogicalTerminationPoint');
const tcpClientInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/TcpClientInterface');
const ForwardingDomain = require('onf-core-model-ap/applicationPattern/onfModel/models/ForwardingDomain');
const ForwardingConstruct = require('onf-core-model-ap/applicationPattern/onfModel/models/ForwardingConstruct');

const softwareUpgrade = require('./individualServices/SoftwareUpgrade');
const TcpServerInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/TcpServerInterface');
const FcPort = require('onf-core-model-ap/applicationPattern/onfModel/models/FcPort');
const { getIndexAliasAsync, createResultArray, elasticsearchService } = require('onf-core-model-ap/applicationPattern/services/ElasticsearchService');

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
exports.bequeathYourDataAndDie = function (body, user, originator, xCorrelator, traceIndicator, customerJourney, operationServerName) {
  return new Promise(async function (resolve, reject) {
    try {

      /****************************************************************************************
       * Setting up required local variables from the request body
       ****************************************************************************************/
      let applicationName = body["new-application-name"];
      let releaseNumber = body["new-application-release"];
      let applicationAddress = body["new-application-address"];
      let applicationPort = body["new-application-port"];

      /****************************************************************************************
       * Prepare logicalTerminatinPointConfigurationInput object to 
       * configure logical-termination-point
       ****************************************************************************************/
      let isdataTransferRequired = true;
      let newReleaseUuid = await httpClientInterface.getHttpClientUuidAsync("NewRelease");
      let currentApplicationName = await httpServerInterface.getApplicationNameAsync();
      if (currentApplicationName == applicationName) {
        let isUpdated = await httpClientInterface.setReleaseNumberAsync(newReleaseUuid, releaseNumber);
        let currentApplicationRemoteAddress = await TcpServerInterface.getLocalAddress();
        let currentApplicationRemotePort = await TcpServerInterface.getLocalPort();
        if((applicationAddress == currentApplicationRemoteAddress) && 
        (applicationPort == currentApplicationRemotePort)){
          isdataTransferRequired = false;
        }
        if (isUpdated) {
          applicationName = await httpClientInterface.getApplicationNameAsync(newReleaseUuid);
          let operationList = [];
          let logicalTerminatinPointConfigurationInput = new LogicalTerminatinPointConfigurationInput(
            applicationName,
            releaseNumber,
            applicationAddress,
            applicationPort,
            operationList
          );
          let logicalTerminationPointconfigurationStatus = await LogicalTerminationPointService.createOrUpdateApplicationInformationAsync(
            logicalTerminatinPointConfigurationInput
          );

          /****************************************************************************************
           * Prepare attributes to automate forwarding-construct
           ****************************************************************************************/
          let forwardingAutomationInputList = await prepareForwardingAutomation.bequeathYourDataAndDie(
            logicalTerminationPointconfigurationStatus
          );
          ForwardingAutomationService.automateForwardingConstructAsync(
            operationServerName,
            forwardingAutomationInputList,
            user,
            xCorrelator,
            traceIndicator,
            customerJourney
          );
        }        
      } 
      softwareUpgrade.upgradeSoftwareVersion(isdataTransferRequired, user, xCorrelator, traceIndicator, customerJourney)
        .catch(err => console.log(`upgradeSoftwareVersion failed with error: ${err}`));  
      resolve();
    } catch (error) {
      reject(error);
    }
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
exports.disregardApplication = function (body, user, originator, xCorrelator, traceIndicator, customerJourney, operationServerName) {
  return new Promise(async function (resolve, reject) {
    try {

      /****************************************************************************************
       * Setting up required local variables from the request body
       ****************************************************************************************/
      let applicationName = body["application-name"];
      let applicationReleaseNumber = body["application-release-number"];

      /****************************************************************************************
       * Prepare logicalTerminatinPointConfigurationInput object to 
       * configure logical-termination-point
       ****************************************************************************************/

      let logicalTerminationPointconfigurationStatus = await LogicalTerminationPointService.deleteApplicationInformationAsync(
        applicationName,
        applicationReleaseNumber
      );

      /****************************************************************************************
       * Prepare attributes to configure forwarding-construct
       ****************************************************************************************/

      let forwardingConfigurationInputList = [];
      let forwardingConstructConfigurationStatus;
      let operationClientConfigurationStatusList = logicalTerminationPointconfigurationStatus.operationClientConfigurationStatusList;

      if (operationClientConfigurationStatusList) {
        forwardingConfigurationInputList = await prepareForwardingConfiguration.disregardApplication(
          operationClientConfigurationStatusList
        );
        forwardingConstructConfigurationStatus = await ForwardingConfigurationService.
        unConfigureForwardingConstructAsync(
          operationServerName,
          forwardingConfigurationInputList
        );
      }

      /****************************************************************************************
       * Prepare attributes to automate forwarding-construct
       ****************************************************************************************/
      let forwardingAutomationInputList = await prepareForwardingAutomation.disregardApplication(
        logicalTerminationPointconfigurationStatus,
        forwardingConstructConfigurationStatus
      );
      ForwardingAutomationService.automateForwardingConstructAsync(
        operationServerName,
        forwardingAutomationInputList,
        user,
        xCorrelator,
        traceIndicator,
        customerJourney
      );

      resolve();
    } catch (error) {
      reject(error);
    }
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
exports.listApplications = function (user, originator, xCorrelator, traceIndicator, customerJourney) {
  return new Promise(async function (resolve, reject) {
    let response = {};
    try {
      /****************************************************************************************
       * Preparing response body
       ****************************************************************************************/
      let applicationList = await getAllApplicationList();

      /****************************************************************************************
       * Setting 'application/json' response body
       ****************************************************************************************/
      response['application/json'] = onfAttributeFormatter.modifyJsonObjectKeysToKebabCase(applicationList);
    } catch (error) {
      console.log(error);
    }
    if (Object.keys(response).length > 0) {
      resolve(response[Object.keys(response)[0]]);
    } else {
      resolve();
    }
  });
}


/**
 * Provides list of recorded service requests
 *
 * body V1_listrecords_body
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * returns List
 **/
exports.listRecords = function (body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  return new Promise(async function (resolve, reject) {
    let numberOfRecords = body["number-of-records"];
    let latest = body["latest-record"];
    let indexAlias = await getIndexAliasAsync();
    try {
      let client = await elasticsearchService.getClient();
      const result = await client.search({
        index: indexAlias,
        from: latest,
        size: numberOfRecords,
        body: {
          query: {
              match_all: {}
          }
        }
      });
      resolve(createResultArray(result));
    } catch (error) {
      console.log(error);
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
exports.listRecordsOfFlow = function (body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  return new Promise(async function (resolve, reject) {
    let numberOfRecords = body["number-of-records"];
    let latest = body["latest-match"];
    let desiredXCorrelator = body["x-correlator"];
    let indexAlias = await getIndexAliasAsync();
    try {
      let client = await elasticsearchService.getClient();
      const result = await client.search({
        index: indexAlias,
        from: latest,
        size: numberOfRecords,
        body: {
          query: {
            term: {
              "x-correlator": desiredXCorrelator
            }
          }
        }
      });
      resolve(createResultArray(result));
    } catch (error) {
      console.log(error);
    }
  });
}


/**
 * Provides list of unsuccessful service requests
 *
 * body V1_listrecordsofunsuccessful_body
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * returns List
 **/
exports.listRecordsOfUnsuccessful = function (body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  return new Promise(async function (resolve, reject) {
    let numberOfRecords = body["number-of-records"];
    let latest = body["latest-unsuccessful"];
    let indexAlias = await getIndexAliasAsync();
    try {
      let client = await elasticsearchService.getClient();
      const result = await client.search({
        index: indexAlias,
        from: latest,
        size: numberOfRecords,
        body: {
          query: {
            bool: {
              must_not: {
                  range: {
                    'response-code': {
                        gte: 200,
                        lt: 300
                    }
                  }
              }
            }
          }
        }
      });
      resolve(createResultArray(result));
    } catch (error) {
      console.log(error);
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
exports.recordServiceRequest = function (body, user, originator, xCorrelator, traceIndicator, customerJourney) {
  return new Promise(async function (resolve, reject) {
    try {

      /****************************************************************************************
       * Setting up required local variables from the request body
       ****************************************************************************************/
      let serviceRecord = body;

      /****************************************************************************************
       * configure application profile with the new application if it is not already exist
       ****************************************************************************************/
      let serviceProfile = await serviceRecordProfile.createProfileAsync(
        serviceRecord
      );
      if (serviceProfile) {
        await ProfileCollection.addProfileAsync(serviceProfile);
      }

      resolve();
    } catch (error) {
      reject(error);
    }
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
exports.regardApplication = function (body, user, originator, xCorrelator, traceIndicator, customerJourney, operationServerName) {
  return new Promise(async function (resolve, reject) {
    try {

      /****************************************************************************************
       * Setting up required local variables from the request body
       ****************************************************************************************/
      let applicationName = body["application-name"];
      let releaseNumber = body["application-release-number"];
      let applicationAddress = body["application-address"];
      let applicationPort = body["application-port"];
      let inquireOamRequestOperation = "/v1/redirect-service-request-information";

      /****************************************************************************************
       * Prepare logicalTerminatinPointConfigurationInput object to 
       * configure logical-termination-point
       ****************************************************************************************/

      let operationList = [
        inquireOamRequestOperation
      ];
      let logicalTerminatinPointConfigurationInput = new LogicalTerminatinPointConfigurationInput(
        applicationName,
        releaseNumber,
        applicationAddress,
        applicationPort,
        operationList
      );
      let logicalTerminationPointconfigurationStatus = await LogicalTerminationPointService.createOrUpdateApplicationInformationAsync(
        logicalTerminatinPointConfigurationInput
      );


      /****************************************************************************************
       * Prepare attributes to configure forwarding-construct
       ****************************************************************************************/

      let forwardingConfigurationInputList = [];
      let forwardingConstructConfigurationStatus;
      let operationClientConfigurationStatusList = logicalTerminationPointconfigurationStatus.operationClientConfigurationStatusList;

      if (operationClientConfigurationStatusList) {
        forwardingConfigurationInputList = await prepareForwardingConfiguration.regardApplication(
          operationClientConfigurationStatusList,
          inquireOamRequestOperation
        );
        forwardingConstructConfigurationStatus = await ForwardingConfigurationService.
        configureForwardingConstructAsync(
          operationServerName,
          forwardingConfigurationInputList
        );
      }

      /****************************************************************************************
       * Prepare attributes to automate forwarding-construct
       ****************************************************************************************/
      let forwardingAutomationInputList = await prepareForwardingAutomation.regardApplication(
        logicalTerminationPointconfigurationStatus,
        forwardingConstructConfigurationStatus,
        applicationName,
        releaseNumber
      );
      ForwardingAutomationService.automateForwardingConstructAsync(
        operationServerName,
        forwardingAutomationInputList,
        user,
        xCorrelator,
        traceIndicator,
        customerJourney
      );

      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/****************************************************************************************
 * Functions utilized by individual services
 ****************************************************************************************/

/**
 * @description This function returns list of registered application information application-name , release-number, application-address, application-port.
 * @return {Promise} return the list of application information
 * <b><u>Procedure :</u></b><br>
 * <b>step 1 :</b> Get forwarding-construct based on ForwardingName
 * <b>step 2 :</b> Get forwarding-construct UUID
 * <b>step 3 :</b> Get fc-port list using forwarding-construct UUID
 * <b>step 4 :</b> Fetch http-client-list using logical-termination-point uuid from fc-port
 * <b>step 5 :</b> get the application name, release number and server-ltp<br>
 * <b>step 6 :</b> get the ipaddress and port name of each associated tcp-client <br>
 **/
function getAllApplicationList() {
  return new Promise(async function (resolve, reject) {
    let clientApplicationList = [];
    const forwardingName = "ApprovedApplicationCausesRequestForServiceRequestInformation";
    try {

      /** 
       * This class instantiate objects that holds the application name , release number, 
       * IpAddress and port information of the registered client applications
       */
      let clientApplicationInformation = class ClientApplicationInformation {
        applicationName;
        applicationReleaseNumber;
        applicationAddress;
        applicationPort;

        /**
         * @constructor 
         * @param {String} applicationName name of the client application.
         * @param {String} applicationReleaseNumber release number of the application.
         * @param {String} applicationAddress ip address of the application.
         * @param {String} applicationPort port of the application.
         **/
        constructor(applicationName, applicationReleaseNumber, applicationAddress, applicationPort) {
          this.applicationName = applicationName;
          this.applicationReleaseNumber = applicationReleaseNumber;
          this.applicationAddress = applicationAddress;
          this.applicationPort = applicationPort;
        }
      };
      let forwardingConstructForTheForwardingName = await ForwardingDomain.getForwardingConstructForTheForwardingNameAsync(forwardingName);
      let forwardingConstructUuid = forwardingConstructForTheForwardingName[onfAttributes.GLOBAL_CLASS.UUID];
      let fcPortList = await ForwardingConstruct.getFcPortListAsync(forwardingConstructUuid);
      let httpClientUuidList = []

      for(let fcPortIndex = 0; fcPortIndex < fcPortList.length; fcPortIndex++){
        if(fcPortList[fcPortIndex][onfAttributes.FC_PORT.PORT_DIRECTION] === FcPort.portDirectionEnum.OUTPUT){
            let serverLtpList = await logicalTerminationPoint.getServerLtpListAsync(fcPortList[fcPortIndex][onfAttributes.FC_PORT.LOGICAL_TERMINATION_POINT])
            httpClientUuidList = httpClientUuidList.concat(serverLtpList)
        }
      }
      for (let i = 0; i < httpClientUuidList.length; i++) {
        let httpClientUuid = httpClientUuidList[i];
        let applicationName = await httpClientInterface.getApplicationNameAsync(httpClientUuid);
        let applicationReleaseNumber = await httpClientInterface.getReleaseNumberAsync(httpClientUuid);
        let serverLtp = await logicalTerminationPoint.getServerLtpListAsync(httpClientUuid);
        let tcpClientUuid = serverLtp[0];
        let applicationAddress = await tcpClientInterface.getRemoteAddressAsync(tcpClientUuid);
        let applicationPort = await tcpClientInterface.getRemotePortAsync(tcpClientUuid);
        let clientApplication = new clientApplicationInformation(applicationName, applicationReleaseNumber, applicationAddress, applicationPort);
        clientApplicationList.push(clientApplication);
      }
      resolve(clientApplicationList);
    } catch (error) {
      reject();
    }
  });
}