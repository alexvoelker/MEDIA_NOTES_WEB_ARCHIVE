import {
  get_library_size,
  add_item_details_db,
  get_library_data,
  get_item_archive_data,
  add_user_note,
  update_user_note,
  delete_user_note,
  check_existing_user,
  insert_new_user_in_db,
  get_existing_user_details,
} from "./database_engine.js";
import { get_api_response_base } from "./api_helper.js";
import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";

const app = express();
const port = 3000;
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // cookies are set to expire after one week
    },
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

app.get("/search", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.redirect("/login");
  } else {
    const page_data = {
      page_name: "home",
      library_size: await get_library_size(req.user.id),
    };

    res.locals = page_data;
    res.render("search.ejs");
  }
});

app.get("/", (req, res) => {
  res.redirect("/library");
});

app.post("/search", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.redirect("/login");
  } else {
    const page_data = {
      page_name: "home",
      library_size: await get_library_size(req.user.id),
    };
    try {
      const search_query = {
        type: req.body["query_type"],
        query: req.body["query_string"],
      };

      if (!search_query.type || !search_query.query) {
        throw new Error("invalid form inputs");
      }

      const search_results = await get_api_response_base(search_query);
      page_data.search_query = search_query;
      page_data.search_results = search_results;
    } catch (error) {
      console.log(`Errored: ${error}`);
    }
    res.locals = page_data;
    res.render("search.ejs");
  }
});

app.post("/add", async (req, res) => {
  // Add an item to the user's library
  if (!req.isAuthenticated()) {
    res.redirect("/login");
  } else {
    try {
      let selection = req.body["search_selection"];
      selection = selection.split(":");

      const selection_item = {
        type: selection[0],
        id: selection[1],
        image_url: `${selection[2]}:${selection[3]}`,
      };

      if (!selection_item) {
        console.log(selection, selection_item);
        throw new Error("POST /add: invalid input");
      }

      await add_item_details_db(
        selection_item.type,
        selection_item.id,
        req.user.id,
        selection_item.image_url
      );

      res.redirect("/library");
    } catch (error) {
      console.log(`Errored: ${error}`);
      res.redirect("/");
    }
  }
});

app.get("/library", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.redirect("/login");
  } else {
    const page_data = {
      page_name: "library",
    };

    page_data.library_data = await get_library_data(req.user.id);
    page_data.library_size = page_data.library_data.length;
    res.locals = page_data;

    res.render("library.ejs");
  }
});

// TODO: add functions to modify the user's watch-list status? in library
// TODO: add functions to remove item from user's library?

app.get("/archive/:type/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.redirect("/login");
  } else {
    const page_data = {
      page_name: "library",
      library_size: await get_library_size(req.user.id),
    };

    const type = req.params["type"];
    const item_id = req.params["id"];
    page_data.type = type;
    page_data.id = item_id;
    page_data.item_data = await get_item_archive_data(
      type,
      item_id,
      req.user.id
    );

    res.locals = page_data;
    res.render("archive_item.ejs");
  }
});

// add functions to modify a user's data based on this page
app.post("/archive/:type/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.redirect("/login");
  } else {
    const type = req.params["type"];
    const item_id = req.params["id"];
    const message = req.body["message"];

    try {
      await add_user_note(type, req.user.id, item_id, message);
    } catch (error) {
      console.log(`Errored: ${error}`);
    }

    res.redirect(`/archive/${type}/${item_id}`);
  }
});

app.post("/archive/:type/:id/put", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.redirect("/login");
  } else {
    const type = req.params["type"];
    const item_id = req.params["id"];

    const id = req.body["id"];
    const message = req.body["message"];

    try {
      await update_user_note(type, req.user.id, id, message);
    } catch (error) {
      console.log(`Errored: ${error}`);
    }

    res.redirect(`/archive/${type}/${item_id}`);
  }
});

app.post("/archive/:type/:id/delete", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.redirect("/login");
  } else {
    const type = req.params["type"];
    const item_id = req.params["id"];

    const id = req.body["id"];
    try {
      await delete_user_note(type, id, req.user.id);
    } catch (error) {
      console.log(`Errored: ${error}`);
    }

    res.redirect(`/archive/${type}/${item_id}`);
  }
});

app.get("/account", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.redirect("/login");
  } else {
    const page_data = {
      page_name: "account",
      library_size: await get_library_size(req.user.id),
    };

    res.locals = page_data;
    res.render("account.ejs");
  }
});

// TODO: make /login and /register not accessible when logged in?
app.get("/login", (req, res) => {
  const page_data = {
    page_name: "login",
    library_size: -1,
  };
  res.locals = page_data;
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  const page_data = {
    page_name: "register",
    library_size: -1,
  };
  res.locals = page_data;
  res.render("register.ejs");
});

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await check_existing_user(email);

    if (checkResult.rows.length > 0) {
      res.send("Username already exists. Try logging in."); // TODO: make a more elegant response here
    } else {
      //hashing the password and saving it in the database
      bcrypt.hash(
        password,
        Number(process.env.SALT_ROUNDS),
        async (err, hash) => {
          if (err) {
            console.error("Error hashing password:", err);
          } else {
            const result = await insert_new_user_in_db(email, hash);
            const user = result.rows[0];
            req.login(user, (err) => {
              if (err) {
                console.log(err);
              } else {
                res.redirect("/");
              }
            });
          }
        }
      );
    }
  } catch (err) {
    console.log(err);
  }
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", {
    successRedirect: "/library",
    failureRedirect: "/login",
  })
);

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/library",
    failureRedirect: "/login",
  })
);

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await get_existing_user_details(username);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            return cb(err);
          } else {
            if (valid) {
              return cb(null, { id: user.id, username: user.username }); // TODO: make sure the password isn't being shared around
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      // TODO: make this work properly for this application
      try {
        // console.log(profile);
        const result = await get_existing_user_details(profile.email);
        if (result.rows.length === 0) {
          const newUser = await insert_new_user_in_db(
            profile.email,
            "google-oauth-login"
          );
          // TODO: make sure the "password" isn't being returned here
          return cb(null, {
            id: newUser.rows[0].id,
            username: newUser.rows[0].username,
          });
        } else {
          return cb(null, {
            id: result.rows[0].id,
            username: result.rows[0].username,
          });
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);
passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
