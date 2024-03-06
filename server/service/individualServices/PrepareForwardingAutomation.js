const ForwardingConstructAutomationInput = require('onf-core-model-ap/applicationPattern/onfModel/services/models/forwardingConstruct/AutomationInput');
const TcpServerInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/TcpServerInterface');
const HttpServerInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/HttpServerInterface');
const prepareALTForwardingAutomation = require('onf-core-model-ap-bs/basicServices/services/PrepareALTForwardingAutomation');
const ForwardingAutomationService = require('onf-core-model-ap/applicationPattern/onfModel/services/ForwardingConstructAutomationServices');
const onfAttributeFormatter = require('onf-core-model-ap/applicationPattern/onfModel/utility/OnfAttributeFormatter');
const onfAttributes = require('onf-core-model-ap/applicationPattern/onfModel/constants/OnfAttributes');
const FcPort = require('onf-core-model-ap/applicationPattern/onfModel/models/FcPort');
const ForwardingDomain = require('onf-core-model-ap/applicationPattern/onfModel/models/ForwardingDomain');
const eventDispatcher = require('onf-core-model-ap/applicationPattern/rest/client/eventDispatcher');
const OperationClientInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/OperationClientInterface');
const IntegerProfile = require('onf-core-model-ap/applicationPattern/onfModel/models/profile/IntegerProfile');

/**
 * This method performs the set of callback to RegardApplicationCausesSequenceForInquiringServiceRecords
 * @param {String} applicationName from {$request.body#application-name}
 * @param {String} releaseNumber from {$request.body#release-number}
 * @param {String} operationServerName : name of the operation server
 * @param {Array<ForwardingConstructAutomationInput>} applicationLayerTopologyForwardingInputList list of forwardings
 * @param {String} user User identifier from the system starting the service call
 * @param {String} xCorrelator UUID for the service execution flow that allows to correlate requests and responses
 * @param {String} traceIndicator Sequence of request numbers along the flow
 * @param {String} customerJourney Holds information supporting customer’s journey to which the execution applies
 * @returns {Promise} promise resolved if-successful then successfully-connected-true or if-unsuccessful successfully-connected-false else promise reject
 * The following are the list of forwarding that will be automated to redirect the RegardApplicationCausesSequenceForInquiringServiceRecords
 * 1. CreateLinkForInquiringServiceRecords
 * 2. RequestForInquiringServiceRecords
 * 3. CreateLinkForSendingServiceRecords
 */
exports.regardApplication = function (applicationName, releaseNumber, 
    operationServerName, httpClientUuid, applicationLayerTopologyForwardingInputList, user, xCorrelator, traceIndicator, customerJourney) {
    return new Promise(async function (resolve, reject) {
        try {
            const result = await CreateLinkForInquiringServiceRecords(applicationName, releaseNumber, user, xCorrelator, traceIndicator, customerJourney)
            if(!result['client-successfully-added'] || result.code != 200){
                resolve(result);
            }
            else{

                // Get the operationClientUuid for which the operation-key updated is expected
                const serverName = '/v1/redirect-service-request-information';
                let operationClientUuid = await OperationClientInterface.getOperationClientUuidAsync(httpClientUuid, serverName);
                // maxmimum time to wait (from integer)
                let waitTime = await IntegerProfile.maximumWaitTimeToReceiveOperationKey();
                let timestampOfCurrentRequest = Date.now();
                let maximumWaitTimeToReceiveOperationKey = await IntegerProfile.waitUntilOperationKeyIsUpdated(operationClientUuid, timestampOfCurrentRequest, waitTime);
                if(waitTime > maximumWaitTimeToReceiveOperationKey){
                    resolve(
                        { 'successfully-connected': false }
                    );
                }
                else{
                    const result = await RequestForInquiringServiceRecords(applicationLayerTopologyForwardingInputList, applicationName, releaseNumber, 
                        operationServerName, user, xCorrelator, traceIndicator, customerJourney)
                    
                    if(result.code != 204){
                        resolve(result);
                    }
                    else{
                        let attempts = 1;
                        let maximumNumberOfAttemptsToCreateLink = await IntegerProfile.maximumNumberOfAttemptsToCreateLink();
                        for(let i=0; i < maximumNumberOfAttemptsToCreateLink; i++){
                            const result = await CreateLinkForReceivingServiceRecords(applicationName, releaseNumber, user, xCorrelator, traceIndicator, customerJourney)
                            if((attempts<=maximumNumberOfAttemptsToCreateLink) 
                                && (result['client-successfully-added'] == false) 
                                && ((result['reason-of-failure'] == 'ALT_SERVING_APPLICATION_NAME_UNKNOWN') 
                                || (result['reason-of-failure'] == 'ALT_SERVING_APPLICATION_RELEASE_NUMBER_UNKNOWN')))
                            {
                                attempts = attempts+1;
                            }else{
                                if(!result['client-successfully-added'] || result.code != 200){
                                    resolve(result);
                                }else{
                                    if(waitTime > maximumWaitTimeToReceiveOperationKey){
                                        resolve(
                                            { 'successfully-connected': false }
                                        );
                                    }
                                    else{
                                        resolve(
                                            { 'successfully-connected': true }
                                        );
                                    }
                                }
                                //exit();
                            }  
                        }
                        
                    }
                }
            }          
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Prepare attributes and automate RegardApplicationCausesSequenceForInquiringServiceRecords.CreateLinkForInquiringServiceRecords<br>
 * @param {String} applicationName from {$request.body#application-name}
 * @param {String} releaseNumber from {$request.body#release-number}
 * @param {String} user User identifier from the system starting the service call
 * @param {String} xCorrelator UUID for the service execution flow that allows to correlate requests and responses
 * @param {String} traceIndicator Sequence of request numbers along the flow
 * @param {String} customerJourney Holds information supporting customer’s journey to which the execution applies
 * @returns {Promise} if operation success then promise resolved with client-successfully-added: boolean, reason-of-failure: string else promise reject
 */
async function CreateLinkForInquiringServiceRecords(applicationName, releaseNumber, user, xCorrelator, traceIndicator, customerJourney) {
        return new Promise(async function (resolve, reject) {
            try {
                let forwardingKindNameOfInquiringServiceRecords = "RegardApplicationCausesSequenceForInquiringServiceRecords.CreateLinkForInquiringServiceRecords";
                try {
                    let requestBody = {};
                    requestBody['serving-application-name'] = applicationName;
                    requestBody['serving-application-release-number'] = releaseNumber;
                    requestBody['operation-name'] = "/v1/redirect-service-request-information";
                    requestBody['consuming-application-name'] = await HttpServerInterface.getApplicationNameAsync();
                    requestBody['consuming-application-release-number'] = await HttpServerInterface.getReleaseNumberAsync();    
                    requestBody = onfAttributeFormatter.modifyJsonObjectKeysToKebabCase(requestBody);
                    result = await forwardRequest(
                        forwardingKindNameOfInquiringServiceRecords,
                        requestBody,
                        user,
                        xCorrelator,
                        traceIndicator,
                        customerJourney
                    );
                } catch (error) {
                    console.log(error);
                    throw "operation is not success";
                }
    
                resolve({
                    "client-successfully-added": true,
                    "reason-of-failure": ""
                });
                //resolve(result);
            } catch (error) {
                reject(error);
            }
        });
}

/**
 * This method performs the set of callback to RegardApplicationCausesSequenceForInquiringServiceRecords
 * @param {Array<ForwardingConstructAutomationInput>} applicationLayerTopologyForwardingInputList list of forwardings
 * @param {String} applicationName from {$request.body#application-name}
 * @param {String} releaseNumber from {$request.body#release-number}
 * @param {String} operationServerName : name of the operation server
 * @param {String} user User identifier from the system starting the service call
 * @param {String} xCorrelator UUID for the service execution flow that allows to correlate requests and responses
 * @param {String} traceIndicator Sequence of request numbers along the flow
 * @param {String} customerJourney Holds information supporting customer’s journey to which the execution applies
 * @returns {Promise} Promise is resolved if the operation succeeded else the Promise is rejected
 */
async function RequestForInquiringServiceRecords(applicationLayerTopologyForwardingInputList, applicationName, releaseNumber, 
    operationServerName, user, xCorrelator, traceIndicator, customerJourney) {
    return new Promise(async function (resolve, reject) {
        let forwardingConstructAutomationList = [];
        try {
            /********************************************************************************************************
             * RegardApplicationCausesSequenceForInquiringServiceRecords.RequestForInquiringServiceRecords /v1/redirect-service-request-information
             ********************************************************************************************************/
            let redirectServiceRequestForwardingName = "RegardApplicationCausesSequenceForInquiringServiceRecords.RequestForInquiringServiceRecords";
            let redirectServiceRequestContext = applicationName + releaseNumber;
            let redirectServiceRequestRequestBody = {};
            redirectServiceRequestRequestBody.serviceLogApplication = await HttpServerInterface.getApplicationNameAsync();
            redirectServiceRequestRequestBody.serviceLogApplicationReleaseNumber = await HttpServerInterface.getReleaseNumberAsync();
            redirectServiceRequestRequestBody.serviceLogOperation = "/v1/record-service-request";
            redirectServiceRequestRequestBody.serviceLogAddress = await TcpServerInterface.getLocalAddressForForwarding();
            redirectServiceRequestRequestBody.serviceLogPort = await TcpServerInterface.getLocalPort();
            redirectServiceRequestRequestBody.serviceLogProtocol = await TcpServerInterface.getLocalProtocol();
            redirectServiceRequestRequestBody = onfAttributeFormatter.modifyJsonObjectKeysToKebabCase(redirectServiceRequestRequestBody);
            let forwardingAutomation = new ForwardingConstructAutomationInput(
                redirectServiceRequestForwardingName,
                redirectServiceRequestRequestBody,
                redirectServiceRequestContext
            );
            forwardingConstructAutomationList.push(forwardingAutomation);
            forwardingConstructAutomationList = forwardingConstructAutomationList.concat(applicationLayerTopologyForwardingInputList);
            const result = await ForwardingAutomationService.automateForwardingConstructAsync(
                operationServerName,
                forwardingConstructAutomationList,
                user,
                xCorrelator,
                traceIndicator,
                customerJourney
              );
            
            resolve({
                "code": 204,
                "reason-of-failure": ""
            });
            //resolve(result);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Prepare attributes and automate RegardApplicationCausesSequenceForInquiringServiceRecords.CreateLinkForSendingServiceRecords<br>
 * @param {String} applicationName from {$request.body#application-name}
 * @param {String} releaseNumber from {$request.body#release-number}
 * @param {String} user User identifier from the system starting the service call
 * @param {String} xCorrelator UUID for the service execution flow that allows to correlate requests and responses
 * @param {String} traceIndicator Sequence of request numbers along the flow
 * @param {String} customerJourney Holds information supporting customer’s journey to which the execution applies
 * @returns {Promise} if operation success then promise resolved with client-successfully-added: boolean, reason-of-failure: string else promise reject
 */
async function CreateLinkForReceivingServiceRecords(applicationName, releaseNumber, user, xCorrelator, traceIndicator, customerJourney) {
    return new Promise(async function (resolve, reject) {
        try {
            let forwardingKindNameOfInquiringServiceRecords = "RegardApplicationCausesSequenceForInquiringServiceRecords.CreateLinkForReceivingServiceRecords";
            try {
                let requestBody = {};
                requestBody['serving-application-name'] = await HttpServerInterface.getApplicationNameAsync();
                requestBody['serving-application-release-number'] = await HttpServerInterface.getReleaseNumberAsync();
                requestBody['operation-name'] = "/v1/record-service-request";
                requestBody['consuming-application-name'] = applicationName;
                requestBody['consuming-application-release-number'] = releaseNumber;    
                requestBody = onfAttributeFormatter.modifyJsonObjectKeysToKebabCase(requestBody);
                result = await forwardRequest(
                    forwardingKindNameOfInquiringServiceRecords,
                    requestBody,
                    user,
                    xCorrelator,
                    traceIndicator,
                    customerJourney
                );
            } catch (error) {
                console.log(error);
                throw "operation is not success";
            }

            resolve({
                "client-successfully-added": true,
                "reason-of-failure": ""
            });
            //resolve(result);
        } catch (error) {
            reject(error);
        }
    });
}

exports.OAMLayerRequest = function (uuid) {
    return new Promise(async function (resolve, reject) {
        try {
            let applicationLayerTopologyForwardingInputList = await prepareALTForwardingAutomation.getALTForwardingAutomationInputForOamRequestAsync(
                uuid
            );
            if (applicationLayerTopologyForwardingInputList) {
                resolve(applicationLayerTopologyForwardingInputList);
            }
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * @description This function automates the forwarding construct by calling the appropriate call back operations based on the fcPort input and output directions.
 * @param {String} forwardingKindName
 * @param {list}   attributeList list of attributes required during forwarding construct automation(to send in the request body)
 * @param {String} user user who initiates this request
 * @param {string} originator originator of the request
 * @param {string} xCorrelator flow id of this request
 * @param {string} traceIndicator trace indicator of the request
 * @param {string} customerJourney customer journey of the request
 **/
function forwardRequest(forwardingKindName, attributeList, user, xCorrelator, traceIndicator, customerJourney) {
    return new Promise(async function (resolve, reject) {
        try {
            let forwardingConstructInstance = await ForwardingDomain.getForwardingConstructForTheForwardingNameAsync(forwardingKindName);
            let operationClientUuid = (getFcPortOutputLogicalTerminationPointList(forwardingConstructInstance))[0];
            let result = await eventDispatcher.dispatchEvent(
                operationClientUuid,
                attributeList,
                user,
                xCorrelator,
                traceIndicator,
                customerJourney
            );
            resolve(result);
        } catch (error) {
            reject(error);
        }
    });
}

function getFcPortOutputLogicalTerminationPointList(forwardingConstructInstance) {
    let fcPortOutputLogicalTerminationPointList = [];
    let fcPortList = forwardingConstructInstance[
        onfAttributes.FORWARDING_CONSTRUCT.FC_PORT];
    for (let i = 0; i < fcPortList.length; i++) {
        let fcPort = fcPortList[i];
        let fcPortPortDirection = fcPort[onfAttributes.FC_PORT.PORT_DIRECTION];
        if (fcPortPortDirection == FcPort.portDirectionEnum.OUTPUT) {
            let fclogicalTerminationPoint = fcPort[onfAttributes.FC_PORT.LOGICAL_TERMINATION_POINT];
            fcPortOutputLogicalTerminationPointList.push(fclogicalTerminationPoint);
        }
    }
    return fcPortOutputLogicalTerminationPointList;
}
