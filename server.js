const express = require("express");
const knex = require("knex");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { check, validationResult } = require("express-validator");

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
const PORT = 3000;
app.use(cors());
app.use(express.json());

//
// GET ALL POSTS
//

app.get("/posts", async (req, res) => {
  const all = await db.select("*").from("posts").orderBy("id", "desc");

  const posts = all.map((post) => {
    post = { ...post, tags: [] };
    post.post_date = new Date(
      post.post_date.getTime() - post.post_date.getTimezoneOffset() * 60000
    );
    post.post_date = new Date(post.post_date).toISOString().split("T")[0];

    return post;
  });

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
//GET SINGLE POST
//

app.get("/posts/:id", async (req, res) => {
  let id = req.params.id;

  const singlePost = await db
    .select("id", "title", "body", "users_id")
    .from("posts")
    .where("id", "=", id)
    .limit(1);

  res.send(singlePost[0]);
});

//
// CREATE POST
//

app.post("/create", async (req, res) => {
  const { title, body, img, tags, users_id } = req.body;

  console.log(req.body);
  const tag_ids = [];

  let postContent = await db("posts")
    .insert({
      title: title,
      body: body,
      img: img,
      post_date: new Date(),
      users_id: users_id,
    })
    .returning(["id", "title", "body", "img", "post_date", "users_id"])
    .then(console.log("inserted posts"));

  let postId = postContent[0].id;

  for (const tag of tags) {
    let tag_id = await db.select("tag_id").from("tags").where("tag", "=", tag);

    tag_id = tag_id[0];

    if (tag_id === undefined) {
      tag_id = await db("tags").insert({ tag }).returning("tag_id");

      tag_id = tag_id[0];
    }
    tag_id = tag_id.tag_id;

    await db("posts_with_tags").insert({
      post_id: postId,
      tags_id: tag_id,
    });

    tag_ids.push(tag_id);
  }
  console.log(postContent[0].post_date);

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
// DELETE POST
//

app.delete("/post/:id", async (req, res) => {
  const id = req.params.id;
  await db("posts").where("id", "=", id).del();
  res.end();
});

//
// LOGIN
//

app.post("/login", (req, res) => {
  db.select("email", "password")
    .from("users")
    .where("email", "=", req.body.email)
    .then(async (data) => {
      console.log(req.body.email);
      const isValid = await bcrypt.compare(req.body.password, data[0].password);

      if (isValid) {
        return db
          .select("user_id", "name", "email", "joined")
          .from("users")
          .where("email", "=", req.body.email)
          .then((user) => {
            console.log(user);
            res.json(user[0]);
          })
          .catch((err) => res.status(400).json("Unable to get user"));
      } else {
        res.status(400).json("");
      }
    })
    .catch((err) => res.status(400).json(""));
});

//
// REGISTER + VALIDATE
//

app.post(
  "/register",
  [
    check("email", "Your email is not valid")
      .not()
      .isEmpty()
      .isEmail()
      .normalizeEmail(),
    check("password", "Your password must be at least 5 characters")
      .not()
      .isEmpty()
      .isLength({ min: 5 }),
  ],
  async (req, res) => {
    const saltRounds = 10;

    const { email, name, password } = req.body;

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).jsonp(errors.array());
    } else {
      const hash = await bcrypt.hash(password, saltRounds);
      await db("users")
        .insert({
          email: email,
          name: name,
          password: hash,
        })
        .then(res.status(200).json("ok"))
        .catch((err) => res.status(400).json("Unable to register"));
    }
  }
);

//
// GET COMMENTS
//

app.get("/comments", async (req, res) => {
  let id = req.params.id;

  const all = await db
    .select("comments.*", "users.name as user_name")
    .from("comments")
    .leftJoin("users", "comments.user_id", "users.user_id");

  const comments = all.map((comment) => {
    comment = { ...comment };
    comment.created_at = new Date(
      comment.created_at.getTime() -
        comment.created_at.getTimezoneOffset() * 60000
    );
    comment.created_at = new Date(comment.created_at)
      .toISOString()
      .split("T")[0];
    return comment;
  });

  console.log(comments);
  res.send(comments);
});

//
// GET SINGLE COMMENT
//

app.get("/comments/:id", async (req, res) => {
  let id = req.params.id;

  const all = await db
    .select("comments.*", "users.name as user_name")
    .from("comments")
    .where("post_id", "=", id)
    .leftJoin("users", "comments.user_id", "users.user_id");

  const comments = all.map((comment) => {
    comment = { ...comment };
    comment.created_at = new Date(
      comment.created_at.getTime() -
        comment.created_at.getTimezoneOffset() * 60000
    );
    comment.created_at = new Date(comment.created_at)
      .toISOString()
      .split("T")[0];
    return comment;
  });
  
  res.send(comments);
});

app.listen(3000, () => {
  console.log("App is up on port " + PORT);
});
