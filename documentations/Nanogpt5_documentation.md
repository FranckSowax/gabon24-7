Set the REPLICATE\_API\_TOKEN environment variable

export REPLICATE\_API\_TOKEN=r8\_Vwm\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*  
Visibility  
Copy

[Learn more about authentication](https://replicate.com/openai/gpt-5-nano/api/learn-more#authentication)

Install Replicate’s Node.js client library

npm install replicate  
Copy  
[Learn more about setup](https://replicate.com/openai/gpt-5-nano/api/learn-more#setup)

Run openai/gpt-5-nano using Replicate’s API. Check out the model's [schema](https://replicate.com/openai/gpt-5-nano/api/schema) for an overview of inputs and outputs.

import Replicate from "replicate";  
const replicate \= new Replicate();

const input \= {  
    prompt: "Explain Bernoulli's principle"  
};

for await (const event of replicate.stream("openai/gpt-5-nano", { input })) {  
  process.stdout.write(\`${event}\`)  
};

//=\> "Bernoulli's principle is a statement in fluid dynamics t...

**Authentication**  
Whenever you make an API request, you need to authenticate using a token. A token is like a password that uniquely identifies your account and grants you access.

The following examples all expect your Replicate access token to be available from the command line. Because tokens are secrets, they should not be in your code. They should instead be stored in [environment variables](https://12factor.net/config). Replicate clients look for the REPLICATE\_API\_TOKEN environment variable and use it if available.

To set this up you can use:

export REPLICATE\_API\_TOKEN=r8\_Vwm\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*  
Visibility  
Copy

Some application frameworks and tools also support a text file named .env which you can edit to include the same token:

REPLICATE\_API\_TOKEN=r8\_Vwm\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*  
Visibility  
Copy

The Replicate API uses the Authorization HTTP header to authenticate requests. If you’re using a [client library](https://replicate.com/docs/reference/client-libraries) this is handled for you.

You can test that your access token is setup correctly by using our [account.get](https://replicate.com/docs/reference/http#account.get) endpoint:

What is cURL?  
curl https://api.replicate.com/v1/account \-H "Authorization: Bearer $REPLICATE\_API\_TOKEN"  
\# {"type":"user","username":"aron","name":"Aron Carroll","github\_url":"https://github.com/aron"}  
Copy

If it is working correctly you will see a JSON object returned containing some information about your account, otherwise ensure that your token is available:

echo "$REPLICATE\_API\_TOKEN"  
\# "r8\_xyz"  
Copy

## **Setup**

NodeJS supports two module formats [ESM](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) and [CommonJS](https://en.wikipedia.org/wiki/CommonJS). Below details the setup for each environment. After setup, the code is identical regardless of module format.

### **ESM**

First you’ll need to ensure you have a NodeJS project:

npm create esm \-y  
Copy

Then install the replicate JavaScript library using npm:

npm install replicate  
Copy

To use the library, first import and create an instance of it:

import Replicate from "replicate";

const replicate \= new Replicate();  
Copy

This will use the REPLICATE\_API\_TOKEN API token you’ve setup in your environment for authorization.

### **CommonJS**

First you’ll need to ensure you have a NodeJS project:

npm create \-y  
Copy

Then install the replicate JavaScript library using npm:

npm install replicate  
Copy

To use the library, first import and create an instance of it:

const Replicate \= require("replicate");

const replicate \= new Replicate();  
Copy

This will use the REPLICATE\_API\_TOKEN API token you’ve setup in your environment for authorization.

## **Run the model**

Use the replicate.run() method to run the model:

const input \= {  
    prompt: "Explain Bernoulli's principle"  
};

const output \= await replicate.run("openai/gpt-5-nano", { input });

console.log(output.join(""));  
//=\> "Bernoulli's principle is a statement in fluid dynamics t...  
Copy

You can learn about pricing for this model on the [model page](https://replicate.com/replicate/openai-gpt-5-nano-internal).

The run() function returns the output directly, which you can then use or pass as the input to another model. If you want to access the full prediction object (not just the output), use the replicate.predictions.create() method instead. This will include the prediction id, status, logs, etc.

## **Streaming**

This model supports streaming. This allows you to receive output as the model is running:

const Replicate \= require("replicate")  
const replicate \= new Replicate()

const input \= {  
    prompt: "Explain Bernoulli's principle"  
};

for await (const event of replicate.stream("openai/gpt-5-nano", { input })) {  
  // event: { event: string; data: string; id: string }  
  process.stdout.write(\`${event}\`)  
  //=\> ""  
};  
process.stdout.write("\\n");  
Copy

The replicate.stream() method returns a [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams) which can be iterated to transform the events into any data structure needed.

For example, to stream just the output content back:

function handler(request) {  
  const stream \= new ReadableStream({  
    async start(controller) {  
      for await (const event of replicate.stream( "openai/gpt-5-nano", { input })) {  
        controller.enqueue(new TextEncoder().encode(\`${event}\`));  
        //=\> ""  
      }  
      controller.close();  
    },  
  });  
  return new Response(stream);  
}  
Copy

Or, stream a list of JSON objects back to the client instead of server sent events:

function handler(request) {  
  const iterator \= replicate.stream( "openai/gpt-5-nano", { input });  
  const stream \= new ReadableStream({  
    async pull(controller) {  
      const { value, done } \= await iterator.next();  
      const encoder \= new TextEncoder();

      if (done) {  
        controller.close();  
      } else if (value.event \=== "output" && value.data.length \> 0\) {  
        controller.enqueue(encoder.encode(JSON.stringify({ data: value.data }) \+ "\\n"));  
      } else {  
        controller.enqueue(encoder.encode(""));  
      }  
    },  
  });  
  return new Response(stream);  
}  
Copy

## **Streaming in the browser**

The JavaScript library is intended to be run on the server. Once the prediction has been created it's output can be streamed directly from the browser.

The streaming URL uses a standard format called [Server Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) (or text/event-stream) built into all web browsers.

A common implementation is to use a web server to create the prediction using replicate.predictions.create, passing the stream property set to true. Then the urls.stream property of the response contains a URL that can be returned to your frontend application:

// POST /run\_prediction  
handler(req, res) {  
  const input \= {  
    prompt: "Explain Bernoulli's principle"  
};  
  const prediction \= await replicate.predictions.create({  
    model: "openai/gpt-5-nano",  
    input,  
    stream: true,  
  });  
  return Response.json({ url: prediction.urls.stream });  
  // Returns {"url": "https://replicate-stream..."}  
}  
Copy

Make a request to the server to create the prediction and use the built-in EventSource object to read the returned url.

const response \= await fetch("/run\_prediction", { method: "POST" });  
const { url } \= await response.json();

const source \= new EventSource(url);  
source.addEventListener("output", (evt) \=\> {  
  console.log(evt.data) //=\> ""  
});  
source.addEventListener("done", (evt) \=\> {  
  console.log("stream is complete");  
});  
Copy

## **Prediction lifecycle**

Running predictions and trainings can often take significant time to complete, beyond what is reasonable for an HTTP request/response.

When you run a model on Replicate, the prediction is created with a “starting” state, then instantly returned. This will then move to "processing" and eventual one of “successful”, "failed" or "canceled".

Starting  
Running  
Succeeded  
Failed  
Canceled

You can explore the prediction lifecycle by using the predictions.get() method to retrieve the latest version of the prediction until completed.

Show example

## **Webhooks**

Webhooks provide real-time updates about your prediction. Specify an endpoint when you [create a prediction](https://replicate.com/docs/reference/http#predictions.create), and Replicate will send HTTP POST requests to that URL when the prediction is created, updated, and finished.

It is possible to provide a URL to the predictions.create() function that will be requested by Replicate when the prediction status changes. This is an alternative to polling.

To receive webhooks you’ll need a web server. The following example uses [Hono](https://hono.dev/), a web standards based server, but this pattern applies to most frameworks.

Show example

Then create the prediction passing in the webhook URL and specify which events you want to receive out of "start", "output", ”logs” and "completed".

const input \= {  
    prompt: "Explain Bernoulli's principle"  
};

const callbackURL \= \`https://my.app/webhooks/replicate\`;  
await replicate.predictions.create({  
  model: "openai/gpt-5-nano",  
  input: input,  
  webhook: callbackURL,  
  webhook\_events\_filter: \["completed"\],  
});

// The server will now handle the event and log:  
// \=\> {"id": "xyz", "status": "successful", ... }  
Copy  
ℹ️ The replicate.run() method is not used here. Because we're using webhooks, and we don’t need to poll for updates.

Co-ordinating between a prediction request and a webhook response will require some glue. A simple implementation for a single JavaScript server could use an event emitter to manage this.

Show example

From a security perspective it is also possible to verify that the webhook came from Replicate. Check out our documentation on [verifying webhooks](https://replicate.com/docs/webhooks#verifying-webhooks) for more information.

## **Access a prediction**

You may wish to access the prediction object. In these cases it’s easier to use the replicate.predictions.create() or replicate.deployments.predictions.create() functions which will return the prediction object.

Though note that these functions will only return the created prediction, and it will not wait for that prediction to be completed before returning. Use replicate.predictions.get() to fetch the latest prediction.

const input \= {  
    prompt: "Explain Bernoulli's principle"  
};  
const prediction \= replicate.predictions.create({  
  model: "openai/gpt-5-nano",  
  input  
});  
// { "id": "xyz123", "status": "starting", ... }  
Copy

## **Cancel a prediction**

You may need to cancel a prediction. Perhaps the user has navigated away from the browser or canceled your application. To prevent unnecessary work and reduce runtime costs you can use the replicate.predictions.cancel function and pass it a prediction id.

await replicate.predictions.cancel(prediction.id);

promptstring

The prompt to send to the model. Do not use if using messages.  
messagesarray

A JSON string representing a list of messages. For example: \[{"role": "user", "content": "Hello, how are you?"}\]. If provided, prompt and system\_prompt are ignored.

Default

\[\]  
verbositystring

Constrains the verbosity of the model's response. Lower values will result in more concise responses, while higher values will result in more verbose responses. Currently supported values are low, medium, and high. GPT-5 supports this parameter to help control whether answers are short and to the point or long and comprehensive.

Default

"medium"  
image\_inputarray

List of images to send to the model

Default

\[\]  
system\_promptstring

System prompt to set the assistant's behavior  
reasoning\_effortstring

Constrains effort on reasoning for GPT-5 models. Currently supported values are minimal, low, medium, and high. The minimal value gets answers back faster without extensive reasoning first. Reducing reasoning effort can result in faster responses and fewer tokens used on reasoning in a response. For higher reasoning efforts you may need to increase your max\_completion\_tokens to avoid empty responses (where all the tokens are used on reasoning).

Default

"minimal"  
max\_completion\_tokensinteger

Maximum number of completion tokens to generate. For higher reasoning efforts you may need to increase your max\_completion\_tokens to avoid empty responses (where all the tokens are used on reasoning).

## **Output schema**

TableJSON  
{  
  "type": "array",  
  "items": {  
    "type": "string"  
  },  
  "title": "Output",  
  "x-cog-array-type": "iterator",  
  "x-cog-array-display": "concatenate"  
}

Create a prediction  
predictions.create  
Headers

* Preferstring  
* Leave the request open and wait for the model to finish generating output. Set to wait=n where n is a number of seconds between 1 and 60\.  
  See https://replicate.com/docs/topics/predictions/create-a-prediction\#sync-mode for more information.  
  Show more

Request body

* inputobjectRequired  
* The model's input as a JSON object. The input schema depends on what model you are running. To see the available inputs, click the "API" tab on the model you are running or [get the model version](https://replicate.com/openai/gpt-5-nano/api/api-reference#models.versions.get) and look at its openapi\_schema property. For example, [stability-ai/sdxl](https://replicate.com/stability-ai/sdxl) takes prompt as an input.  
  Files should be passed as HTTP URLs or data URLs.  
  Use an HTTP URL when:  
  * you have a large file \> 256kb  
  * you want to be able to use the file multiple times  
  * you want your prediction metadata to be associable with your input files  
* Use a data URL when:  
  * you have a small file \<= 256kb  
  * you don't want to upload and host the file somewhere  
  * you don't need to use the file again (Replicate will not store it)  
* Show more  
* streamboolean  
* This field is deprecated.  
  Request a URL to receive streaming output using [server-sent events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).  
  This field is no longer needed as the returned prediction will always have a stream entry in its url property if the model supports streaming.  
  Show more  
* webhookstring  
* An HTTPS URL for receiving a webhook when the prediction has new output. The webhook will be a POST request where the request body is the same as the response body of the [get prediction](https://replicate.com/openai/gpt-5-nano/api/api-reference#predictions.get) operation. If there are network problems, we will retry the webhook a few times, so make sure it can be safely called more than once. Replicate will not follow redirects when sending webhook requests to your service, so be sure to specify a URL that will resolve without redirecting.  
  Show more  
* webhook\_events\_filterarray  
* By default, we will send requests to your webhook URL whenever there are new outputs or the prediction has finished. You can change which events trigger webhook requests by specifying webhook\_events\_filter in the prediction request:  
  * start: immediately on prediction start  
  * output: each time a prediction generates an output (note that predictions can generate multiple outputs)  
  * logs: each time log output is generated by a prediction  
  * completed: when the prediction reaches a terminal state (succeeded/canceled/failed)

For example, if you only wanted requests to be sent at the start and end of the prediction, you would provide:  
{  
  "version": "5c7d5dc6dd8bf75c1acaa8565735e7986bc5b66206b55cca93cb72c9bf15ccaa",  
  "input": {  
    "text": "Alice"  
  },  
  "webhook": "https://example.com/my-webhook",  
  "webhook\_events\_filter": \["start", "completed"\]  
}

* Requests for event types output and logs will be sent at most once every 500ms. If you request start and completed webhooks, then they'll always be sent regardless of throttling.  
  Show more

Examples

Create

Create a prediction and get the output

Streaming

Webhooks  
Make a request  
/predictions  
import Replicate from "replicate";  
const replicate \= new Replicate();

const input \= {  
    prompt: "Explain Bernoulli's principle"  
};

const output \= await replicate.run("openai/gpt-5-nano", { input });

console.log(output.join(""));  
//=\> "Bernoulli's principle is a statement in fluid dynamics t...  
Copy  
Get a prediction  
predictions.get  
Input parameters

* prediction\_idstringRequired  
* The ID of the prediction to get.

Examples

Get

Get the latest version of a prediction by id  
Make a request  
/predictions/{prediction\_id}  
import Replicate from "replicate";  
const replicate \= new Replicate();

console.log("Getting prediction...")  
const prediction \= await replicate.predictions.get(predictionId);  
//=\> {"id": "xyz...", "status": "successful", ... }  
Copy  
Cancel a prediction  
predictions.cancel  
Input parameters

* prediction\_idstringRequired  
* The ID of the prediction to cancel.

Examples

Cancel

Cancel an in progress prediction  
Make a request  
/predictions/{prediction\_id}/cancel  
import Replicate from "replicate";  
const replicate \= new Replicate();

console.log("Canceling prediction...")  
const prediction \= await replicate.predictions.cancel(predictionId);  
//=\> {"id": "xyz...", "status": "canceled", ... }  
Copy  
List predictions  
predictions.list  
Examples  
List  
List the first page of your predictions  
Paginate  
Make a request  
/predictions  
import Replicate from "replicate";  
const replicate \= new Replicate();

const page \= await replicate.predictions.list();  
console.log(page.results)  
//=\> \[{ "id": "xyz...", "status": "successful", ... }, { ... }\]  
