const sqlite3 = require("sqlite3").verbose();

const fs = require("fs").promises;
const path = require("path");
const express = require("express");
const app = express();
const mustacheExpress = require("mustache-express");
const { faker } = require("@faker-js/faker");
const { argv } = require("process");

app.set("views", `${__dirname}`);
app.set("view engine", "mustache");
app.engine("mustache", mustacheExpress());

const dsn = argv[2];
const port = argv[3] || "8080";
const db = new sqlite3.Database(dsn);

app.get("/", async (req, res) => {
  const region = req.query.region;

  if (region && region !== process.env.FLY_REGION) {
    console.log(`redirecting from ${process.env.FLY_REGION} to ${region}`);
    res.header["fly-replay"] = "region=" + region;
  }

  // Query for the most recently added people.
  const rows = db.all(
    `
		SELECT id, name, phone, company
		FROM persons
		ORDER BY id DESC
		LIMIT 10
	`,
    (err, rows) => {
      switch (req.get("accept")) {
        case "text/plain":
          const result = [];
          result.push(`REGION: ${process.env.FLY_REGION}\n`);
          for (person of rows) {
            result.push(
              `- ${person.name} @ ${person.company} (${person.phone})`
            );
          }

          res.send(result.join("\n"));
          return;
        default:
          res.render("index", {
            persons: rows,
            region: process.env.FLY_REGION,
          });
      }
    }
  );
});

app.post("/generate", async (req, res) => {
  // If this node is not primary, look up and redirect to the current primary.
  const primaryFilename = path.join(dsn, ".primary");
  let primary;

  try {
    await fs.access(primaryFilename);
    primary = await fs.readFile(primaryFilename, { encoding: "utf8" });
  } catch (err) {
    console.log(err);
  }

  if (primary) {
    console.log(`redirecting to primary instance: ${primary}`);
    res.headers["fly-replay"] = `instance=${primary}`;
  }

  db.run(
    `INSERT INTO persons (name, phone, company) VALUES (?, ?, ?)`,
    faker.name.fullName(),
    faker.phone.number(),
    faker.company.name()
  );

  res.redirect("/");
});

app.listen(port, async () => {
  const schema = await fs.readFile(path.join(__dirname, "schema.sql"), {
    encoding: "utf8",
  });
  db.exec(schema);

  console.log(`Example app listening on port ${port}`);
});
