const express = require("express");
const path = require("path");
const cluster = require("cluster");
const numCPUs = require("os").cpus().length;

const isDev = process.env.NODE_ENV !== "production";
const PORT = process.env.PORT || 5000;
// const region = (aws.config.region = "us-east-1");
// const S3_BUCKET = process.env.S3_BUCKET;

const S3_BUCKET = "my-site-images-test";

const aws = require("aws-sdk");
// Multi-process to utilize all CPU cores.
if (!isDev && cluster.isMaster) {
  console.error(`Node cluster master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.error(
      `Node cluster worker ${worker.process.pid} exited: code ${code}, signal ${signal}`
    );
  });
} else {
  const app = express();

  app.set("views", "./views");
  app.set("view engine", "ejs");

  app.engine("html", require("ejs").renderFile);

  app.set("view engine", "html");
  // Priority serve any static files.
  app.use(express.static(path.resolve(__dirname, "../react-ui/build")));
  // app.use(express.static(path.resolve(__dirname, "./views/")));

  app.get("/account", (req, res) => res.render("account.html"));

  // Answer API requests.
  app.get("/api", function (req, res) {
    res.set("Content-Type", "application/json");
    res.send('{"message":"Hello from the custom server!"}');
  });

  app.get("/sign-s3", (req, res) => {
    const s3 = new aws.S3();
    // const fileName = req.query["file-name"];
    // const fileType = req.query["file-type"];
    const fileName = "file-name.jpg";
    const fileType = "jpg";
    const s3Params = {
      Bucket: S3_BUCKET,
      Key: fileName,
      Expires: 60,
      ContentType: fileType,
      ACL: "public-read",
    };

    s3.getSignedUrl("putObject", s3Params, (err, data) => {
      if (err) {
        console.log(err);
        return res.end();
      }
      const returnData = {
        signedRequest: data,
        url: `https://${S3_BUCKET}.s3.amazonaws.com/${fileName}`,
      };
      res.write(JSON.stringify(returnData));
      res.end();
      console.log(JSON.stringify(returnData));
    });
  });
  // All remaining requests return the React app, so it can handle routing.
  app.get("*", function (request, response) {
    response.sendFile(
      path.resolve(__dirname, "../react-ui/build", "index.html")
    );
  });

  app.listen(PORT, function () {
    console.error(
      `Node ${
        isDev ? "dev server" : "cluster worker " + process.pid
      }: listening on port ${PORT}`
    );
  });
}
