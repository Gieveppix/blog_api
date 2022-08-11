const express = require("express");
const knex = require("knex");
const cors = require("cors");
const bcrypt = require("bcrypt");

const db = knex({
  client: "pg",
  connection: {
    host: "127.0.0.1",
    port: 5432,
    user: "mmilanovic",
    password: "",
    database: "blog",
  },
});

const app = express();
var PORT = 3000;
app.use(cors());
app.use(express.json());

db.select("*")
  .from("users")
  .then((data) => {
    console.log(data);
  });

//
// GET ALL POSTS
//

app.get("/posts", async (req, res) => {
  const all = await db
    .select("*")
    .from("posts")
    .orderBy("id", "desc")
    .then(console.log("Getting all posts"));
  // console.log(all)

  const posts = all.map((post) => {
    post = { ...post, tags: [] };
    post.post_date = new Date(post.post_date).toISOString().split("T")[0];
    return post;
  });

  //console.log(posts);

  for (const post of posts) {
    const posts_tags = await db
      .select("*")
      .from("posts_with_tags")
      .where("post_id", "=", post.id);

    for (const post_tag of posts_tags) {
      const tag = await db
        .select("tag")
        .from("tags")
        .where("tag_id", "=", post_tag.tags_id);
      post.tags.push(tag[0].tag);
    }
  }
  res.send(posts);
});

//
//GET SINGLE POST (NO TAGS NEEDED)
//

app.get("/posts/:id", async (req, res) => {
  let id = req.params.id;
  //const { title, body } = req.body

  const singlePost = await db
    .select("id", "title", "body")
    .from("posts")
    .where("id", "=", id)
    .limit(1);

  console.log("Getting single post: " + id);
  // console.log(singlePost[0].title);
  // console.log("BODYYYY", singlePost[0].body);
  // console.log(singlePost)

  res.send(singlePost[0]);
});

//
// DELETE POST
//

app.delete("/post/:id", async (req, res) => {
  const id = req.params.id;
  await db("posts").where("id", "=", id).del();
  console.log("Method called is -- " + req.method);
  res.end();
});

//
// CREATE POST
//

app.post("/create", async (req, res) => {
  const { title, body, img, tags } = req.body;

  const tag_ids = [];

  let postContent = await db("posts")
    .insert({
      title: title,
      body: body,
      img: img,
      post_date: new Date(),
    })
    .returning(["id", "title", "body", "img", "post_date"])
    .then(console.log("inserted posts"));

  let postId = postContent[0].id;
  //console.log(postId);

  for (const tag of tags) {
    let tag_id = await db.select("tag_id").from("tags").where("tag", "=", tag);

    tag_id = tag_id[0];

    if (tag_id === undefined) {
      tag_id = await db("tags").insert({ tag }).returning("tag_id");

      tag_id = tag_id[0];
    }
    tag_id = tag_id.tag_id;
    console.log(tag_id);

    await db("posts_with_tags").insert({
      post_id: postId,
      tags_id: tag_id,
    });

    tag_ids.push(tag_id);
  }

  res.json(
    postContent[0].id +
      " " +
      postContent[0].title +
      " " +
      postContent[0].body +
      " " +
      postContent[0].img +
      " " +
      tag_ids +
      " " +
      JSON.stringify(postContent[0].post_date)
  );
});

//
// LOGIN
//

app.post("/login", (req, res) => {
  const [email, password] = req.body;

  res.json("login");
});

//
// REGISTER
//

app.post("/register", async (req, res) => {
  const saltRounds = 10;

  const { email, name, password } = req.body;
  const hash = await bcrypt.hash(password, saltRounds);
    await db("users").insert({
      email: email,
      name: name,
      password: hash,
    });

  res.status(200).json("ok")

  // db.transaction(trx => {
  //     trx.insert({
  //         hash: hash,
  //         email: email
  //     })
  //     .into('login')
  //     .returning('email')
  //     .then(loginEmail => {
  //         return trx('users')
  //         .returning('*')
  //         .insert({
  //             email: loginEmail,
  //             name: name,
  //             joined: new Date()
  //         })
  //         .then(user => {
  //             res.json(user[0])
  //         })
  //     })
  //     .then(trx.commit)
  //     .catch(trx.rollback)
  // })
  // .catch(err => res.status(400).json('Unable to register'))
});

app.listen(3000, () => {
  console.log("App is up on port " + PORT);
});
