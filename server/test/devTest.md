|   Service      | type   | Scenario |  configuration      | callbacks   | passed |   issues |
|--------------|-----------|------------|--------------|-----------|------------|--------------|
|/v1/list-applications|Individual Service||NA||yes||
|/v1/record-service-request|Individual Service||NA||yes||
|/v1/list-records|Individual Service||NA||yes||
|/v1/list-records-of-flow|Individual Service||NA||yes||
|/v1/list-records-of-unsuccessful|Individual Service||NA||yes||
|/v1/disregard-application|Individual Service|with existing  value|Remove information of application(http,tcp,opc,andforwarding)|/v1/disregard-application<br>/v1/delete-ltp-and-dependents|yes||
|/v1/disregard-application|Individual Service|with non existing  value|NA|/v1/disregard-application<br>/v1/delete-ltp-and-dependents|yes|| 