# OCPP Virtual Charge Point

Simple, configurable, terminal-based OCPP Charging Station simulator written in Node.js with Schema validation.

## Watch our video introduction

[![VCP Video](https://img.youtube.com/vi/YsXjnk0mhfA/0.jpg)](https://www.youtube.com/watch?v=YsXjnk0mhfA)

## Prerequisites

- Node.js 12+

Run:

```bash
npm install
```

## Running VCP

Configure env variables:

```
WS_URL - websocket endpoint
CP_ID - ID of this VCP
PASSWORD - if used for OCPP Authentication, otherwise can be left blank
```

Run OCPP 1.6:

```bash
npx tsx index_16.ts
```

Run OCPP 2.0.1:

```bash
npx tsx index_201.ts
```

When testing different configurations, you can create multiple `.env` files and pass the env file as an argument, for example:

```bash
npm start -- --env-file=.env index_16.ts
```

## Example

```bash
> WS_URL=ws://localhost:3000 CP_ID=vcp_16_test npx tsx index_16.ts

2023-03-27 13:09:17 info: Connecting... | {
  endpoint: 'ws://localhost:3000',
  chargePointId: 'vcp_16_test',
  ocppVersion: 'OCPP_1.6',
  basicAuthPassword: 'password',
  adminWsPort: 9999
}
2023-03-27 13:09:17 info: Sending message ➡️  [2,"5fe44756-05e1-4065-9c91-11b456b55913","BootNotification",{"chargePointVendor":"Solidstudio","chargePointModel":"test","chargePointSerialNumber":"S001","firmwareVersion":"1.0.0"}]
2023-03-27 13:09:17 info: Sending message ➡️  [2,"aad8d05d-3a6b-4c51-a9fc-7275d4a6cbc3","StatusNotification",{"connectorId":1,"errorCode":"NoError","status":"Available"}]
2023-03-27 13:09:17 info: Receive message ⬅️  [3,"5fe44756-05e1-4065-9c91-11b456b55913",{"currentTime":"2023-03-27T11:09:17.883Z","interval":30,"status":"Accepted"}]
2023-03-27 13:09:17 info: Receive message ⬅️  [2,"658c8f5b-9f86-487f-91f8-1d656453978a","ChangeConfiguration",{"key":"MeterValueSampleInterval","value":"60"}]
2023-03-27 13:09:17 info: Responding with ➡️  [3,"658c8f5b-9f86-487f-91f8-1d656453978a",{"status":"Accepted"}]
2023-03-27 13:09:17 info: Receive message ⬅️  [2,"34fc4673-deff-48d3-bb8e-d94d75fa619a","GetConfiguration",{"key":["SupportedFeatureProfiles"]}]
2023-03-27 13:09:17 info: Responding with ➡️  [3,"34fc4673-deff-48d3-bb8e-d94d75fa619a",{"configurationKey":[{"key":"SupportedFeatureProfiles","readonly":true,"value":"Core,FirmwareManagement,LocalAuthListManagement,Reservation,SmartCharging,RemoteTrigger"},{"key":"ChargeProfileMaxStackLevel","readonly":true,"value":"99"},{"key":"HeartbeatInterval","readonly":false,"value":"300"},{"key":"GetConfigurationMaxKeys","readonly":true,"value":"99"}]}]
2023-03-27 13:09:17 info: Receive message ⬅️  [3,"aad8d05d-3a6b-4c51-a9fc-7275d4a6cbc3",{}]
2023-03-27 13:09:18 info: Receive message ⬅️  [2,"d7610ad2-63d0-470f-9bd9-6e47d5483429","SetChargingProfile",{"connectorId":0,"csChargingProfiles":{"chargingProfileId":30,"stackLevel":0,"chargingProfilePurpose":"ChargePointMaxProfile","chargingProfileKind":"Absolute","chargingSchedule":{"chargingRateUnit":"A","chargingSchedulePeriod":[{"startPeriod":0,"limit":10.0}]}}}]
2023-03-27 13:09:18 info: Responding with ➡️  [3,"d7610ad2-63d0-470f-9bd9-6e47d5483429",{"status":"Accepted"}]
2023-03-27 13:10:17 info: Sending message ➡️  [2,"79a41b2e-2c4a-4a65-9d7e-417967a8f95f","Heartbeat",{}]
2023-03-27 13:10:17 info: Receive message ⬅️  [3,"79a41b2e-2c4a-4a65-9d7e-417967a8f95f",{"currentTime":"2023-03-27T11:10:17.955Z"}]
```

## Executing Admin Commands

Some messages are automatically sent by the VCP, for example, `BootNotification` or `StartTransaction` and `StopTransaction`.
However, for Operations initiated by Charge Point (compare e.g. with OCPP 1.6, Chapter 4) one can send the messages using `admin` functionality.
VCP exposes a separate Websocket endpoint that will "proxy" all messages to Central System Websocket.
For example usage, see `admin/` folder.

```bash
npx tsx admin/v16/Authorize/authorize.ts
```

---

## Contributing

### Bug Reports & Feature Requests

Please use the [issue tracker](https://github.com/solidstudiosh/ocpp-virtual-charge-point/issues) to report any bugs or file feature requests.

### Developing

We encourage contributions through pull requests and follow the standard "fork-and-pull" git workflow. Feel free to create a fork of the repository, make your changes, and submit a pull request for review. We appreciate your contributions!

1. Fork the repository on GitHub.
2. Clone the forked repository to your local machine.
3. Create a new branch for your changes.
4. Make your changes to the code and commit them to your local branch.
5. Push the changes to your forked repository on GitHub.
6. Create a new pull request on the original repository.
7. Wait for feedback and make any necessary changes.
8. Once your pull request has been reviewed and accepted, it will be merged into the original repository.

When creating your pull request, please include a clear description of the changes you have made, and any relevant context or reasoning behind those changes.
