import * as dotenv from "dotenv";

dotenv.config();

import express from "express";
import fetch from "node-fetch";
import https from "https";
import { v4 as uuidv4 } from "uuid";

import PlayFab from "./node_modules/playfab-sdk/Scripts/PlayFab/PlayFab.js";
import PlayFabClient from "./node_modules/playfab-sdk/Scripts/PlayFab/PlayFabClient.js";

const app = express();
	app.use(express.json());

const GOOGLE_OAUTH_URL = process.env.GOOGLE_OAUTH_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// TODO: replace the callback URLs from your Google Cloud Console App Settings
const GOOGLE_CALLBACK_URL = "https%3A//e85d-132-147-98-233.ngrok-free.app/google/callback";
const GOOGLE_CALLBACK_URL_NOT_SAFE = "https://e85d-132-147-98-233.ngrok-free.app/google/callback";
// const GOOGLE_OAUTH_SCOPES = [
// 	"https%3A//www.googleapis.com/auth/userinfo.email",
// 	"https%3A//www.googleapis.com/auth/userinfo.profile"
// ];
const GOOGLE_OAUTH_SCOPES = [
	"https%3A//www.googleapis.com/auth/userinfo.profile"
];
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_ACCESS_TOKEN_URL = process.env.GOOGLE_ACCESS_TOKEN_URL;

const PLAYFAB_APP_TITLE_ID = process.env.PLAYFAB_APP_TITLE_ID;

const PORT = process.env.PORT || 3000;

//====================================================//
//                    GLOBALS                         //
//====================================================//
//var PlayFab = require("./node_modules/playfab-sdk/Scripts/PlayFab/PlayFab");
//var PlayFabClient = require("./node_modules/playfab-sdk/Scripts/PlayFab/PlayFabClient");
var IdTokenMap = new Map();

//====================================================//
//                       HOME                         //
//====================================================//
app.get("/", async (req, res) => {
  res.send("Playfab HOME");
});

//====================================================//
//                      UUID                          //
//====================================================//
app.get("/uuid", async(req, res)=>{
  res.json({uuid:uuidv4()});
});

//====================================================//
//               LOGIN with Custom ID                 //
//====================================================//
function DoExampleLoginWithCustomID() {
    PlayFab.settings.titleId = "C0466";
    var loginRequest = {
        // Currently, you need to look up the correct format for this object in the API reference for LoginWithCustomID. The Request Headers and Request Body are included as keys and values in the request object.
        TitleId: PlayFab.settings.titleId,
        CustomId: "GettingStartedGuide",
        CreateAccount: true
    };

    // For functions in the Node SDK, the first parameter will be the request object and the second parameter will be the callback function. The callback function executes after the request returns.
    PlayFabClient.LoginWithCustomID(loginRequest, LoginWithCustomIDCallback);
}

function LoginWithCustomIDCallback(error, result) {
    if (result !== null) {
        console.log("\nCongratulations, you made your first successful API call!");
    } else if (error !== null) {
        console.log("Something went wrong with your first API call.");
        console.log("Here's some debug information:");
        console.log(CompilePlayfabErrorReport(error));
    }
}

app.get("/login/customid", async (req, res) => {
	DoExampleLoginWithCustomID();
	res.send("LOGIN with Custom ID Complete");
});

//====================================================//
//                  LOGIN with Google                 //
//====================================================//
function LoginWithGoogleCallback(error, result) {
  console.log(`\nLoginWithGoogleCallback::result:${ JSON.stringify(result) }`);
    if (result !== null) {
        console.log("\nCongratulations, you have successfully logged-in account to Playfab!");
    } else if (error !== null) {
        console.log("\nSomething went wrong with your first API call.");
        console.log("Here's some debug information:");
        console.log(CompilePlayfabErrorReport(error));
    }
}

app.get("/google/callback", async (req, res) => {
  const { code } = req.query;
  const data = {
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_CALLBACK_URL_NOT_SAFE,
    grant_type: "authorization_code",
  };

  const response = await fetch(GOOGLE_ACCESS_TOKEN_URL, {
    method: "POST",
    body: JSON.stringify(data),
  });

  const access_token_data = await response.json();
  let access_token = access_token_data.access_token;

  IdTokenMap.set(req.query.state, access_token);

  const { id_token } = access_token_data;

  const token_info_response = await fetch(
    `${process.env.GOOGLE_TOKEN_INFO_URL}?id_token=${id_token}`
  );

    PlayFab.settings.titleId = PLAYFAB_APP_TITLE_ID;
    var loginRequest = {
        TitleId: PlayFab.settings.titleId,
        CreateAccount: true,
        AccessToken: access_token
    };
    PlayFabClient.LoginWithGoogleAccount( loginRequest, LoginWithGoogleCallback);
  res.send(`Google Login Callback`);
});

app.get("/login/google", async (req, res) => {
    let uuid = req.query.uuid;
    const state = uuid; // TODO: replace with uuid
    const scopes = GOOGLE_OAUTH_SCOPES.join(" ");
    // const GOOGLE_OAUTH_CONSENT_SCREEN_URL = `${GOOGLE_OAUTH_URL}?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_CALLBACK_URL}&access_type=offline&response_type=code&state=${state}&scope=${scopes}`;
    const GOOGLE_OAUTH_CONSENT_SCREEN_URL = `${GOOGLE_OAUTH_URL}?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_CALLBACK_URL}&access_type=offline&response_type=code&state=${state}&scope=${scopes}&include_granted_scopes=true`;
    res.redirect(GOOGLE_OAUTH_CONSENT_SCREEN_URL);
	//res.send("LOGIN with Google Complete");
});

//====================================================//
//                      REVOKE                        //
//====================================================//
// reference: https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke
// or let the user go to this URL https://myaccount.google.com/connections?filters=3,4&hl=en&pli=1
// and revoke the access to your Google Cloud Application
app.get("/revoke", async (req, res)=>{
  let uuid = req.query.uuid;
  let msg;

  // let postData = "token=" + access_token;
  let postData = "token=" + IdTokenMap.get(uuid);
  let postOptions = {
    host: 'oauth2.googleapis.com',
    port: '443',
    path: '/revoke',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const postReq = https.request(postOptions, function (r) {
    r.setEncoding('utf8');
    r.on('data', d => {
      msg = d;
    });
  });

  postReq.on('error', error => {
    msg = error;
    console.log(error)
  });

  // Post the request with data
  postReq.write(postData);
  postReq.end();

  IdTokenMap.delete(uuid);
  console.log("\nIdTokenMap.size:"+IdTokenMap.size);

  res.send("REVOKED");
});

//====================================================//
//                       UTILS                        //
//====================================================//
// This is a utility function we haven't put into the core SDK yet. Feel free to use it.
function CompilePlayfabErrorReport(error) {
    if (error == null)
        return "";
    var fullErrors = error.errorMessage;
    for (var paramName in error.errorDetails)
        for (var msgIdx in error.errorDetails[paramName])
            fullErrors += "\n" + paramName + ": " + error.errorDetails[paramName][msgIdx];
    return fullErrors;
}

//====================================================//
//                INITIALIZATION                      //
//====================================================//
const start = async (port) => {
  app.listen(port, () => {
    console.log(`Server running on port: http://localhost:${port}`);
  });
};
start(PORT);