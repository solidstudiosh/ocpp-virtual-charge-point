# OCPP Virtual Charge Point

A fork of [ocpp-vcp](https://github.com/solidstudiosh/ocpp-vcp)
The original project is a great tool for testing OCPP 1.6 and 2.0.1.

The main target is making this amazing simulator dockerized and usable in integration tests.  
For example, creating the stations dynamically and sending messages to and from them.  
The admin server is now automatically started and takes care of creating the charging stations.

## Prerequisites

- Node.js 12+

Run:

```bash
npm install
```

## Running VCP

Configure env variables if you want to start Charging station automatically:

```
WS_URL - websocket endpoint
STATION_NAME - charging station name
PASSWORD - if used for OCPP Authentication, otherwise can be left blank
OCPP_VERSION - Ocpp version of the charging station (1.6 or 2.0.1 or 2.1) 
```


```bash

npx OCPP_VERSION=1.6 npx tsx stationAPIServer.ts
```

Run OCPP 2.0.1:

```bash
npx OCPP_VERSION=2.0.1 npx tsx stationAPIServer.ts
```


## Example

```bash
> WS_URL=ws://localhost:3000/ws STATION_NAME=Test_Station npx tsx stationAPIServer.ts

2025-09-29 16:44:29 info: Starting admin server on 9999 
2025-09-29 16:44:29 info: Connecting... | {
  endpoint: 'ws://localhost:3000/ws',
  chargePointId: 'Test_Station',
  ocppVersion: 'OCPP_2.0.1',
  basicAuthPassword: undefined
} 
2025-09-29 16:44:29 info: Test_Station:OCPP_2.0.1 Sending message ➡️  [2,"d7768889-cd71-4fe2-b02a-2c2accfc14ac","BootNotification",{"reason":"PowerUp","chargingStation":{"model":"VirtualChargePoint","vendorName":"Solidstudio"}}] 
2025-09-29 16:44:29 info: Test_Station:OCPP_2.0.1 Sending message ➡️  [2,"a7f1f39f-c9f2-4440-856f-5d635d5024b1","StatusNotification",{"timestamp":"2025-09-29T14:44:29.307Z","connectorStatus":"Available","evseId":1,"connectorId":1}] 
2025-09-29 16:44:29 info: Test_Station:OCPP_2.0.1 Receive message ⬅️  [3,"d7768889-cd71-4fe2-b02a-2c2accfc14ac",{"customData":null,"currentTime":"2025-09-29T14:44:29.314Z","interval":60,"status":"Accepted","statusInfo":null}] 
2025-09-29 16:44:29 info: Test_Station:OCPP_2.0.1 Receive message ⬅️  [3,"a7f1f39f-c9f2-4440-856f-5d635d5024b1",{"customData":null}] 
2025-09-29 16:45:29 info: Test_Station:OCPP_2.0.1 Sending message ➡️  [2,"49994c69-2bf9-4a23-a79d-16a4b8555e76","Heartbeat",{}] 
2025-09-29 16:45:29 info: Test_Station:OCPP_2.0.1 Receive message ⬅️  [3,"49994c69-2bf9-4a23-a79d-16a4b8555e76",{"customData":null,"currentTime":"2025-09-29T14:45:29.328Z"}] 
```

Multiple stations with a different OCPP version can be started through the admin server. Admin server doesn't stop after connections to backend are lost. You have to stop the server manually.

```http request
POST http://localhost:9999/station
Content-Type: application/json

{
"stationName": "Test station 2",
"backendEndpoint": "ws://192.168.0.29:3000",
"basicAuthPassword": "testPassword",
"ocppVersion": "OCPP_2.0.1"
}

```

## Docker: Build, tag, and run

Use docker-compose.yml to build and run the Charging Station Simulator. 


## Executing Admin Commands

Some messages are automatically sent by the Charging Station, for example, `BootNotification` or `StartTransaction` and `StopTransaction`.
To send custom messegas use http request to the admin server. 

```http request
POST http://localhost:9999/{stationName}/execute
Content-Type: application/json

{
  action: "TransactionEvent",
  messageId: uuid.v4(),
  payload: {
    eventType: "Started",
    timestamp: date,
    triggerReason: "Authorized",
    seqNo: 1,
    evse: { id: 1 },
    transactionInfo: {
      transactionId: transactionId,
    },
    idToken: {
      idToken: "AABBCCDD",
      type: "ISO14443",
    },
    meterValue: [
      {
        timestamp: date,
        sampledValue: [
          {
            value: 0,
            measurand: "Energy.Active.Import.Register",
          },
        ],
      },
    ],
  }
}

```


