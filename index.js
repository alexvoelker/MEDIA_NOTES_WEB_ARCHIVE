import {
  get_library_size,
  add_item_details_db,
  get_library_data,
  get_item_archive_data,
  add_user_note,
  update_user_note,
  delete_user_note,
} from "./database_engine.js";
import { get_api_response_base } from "./api_helper.js";
import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";

const app = express();
const port = 3000;

// The userID in the database corresponding to the data for the logged-in user
// TODO: change the website to handle/authenticate different users
const userID = 1;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", async (req, res) => {
  const page_data = {
    page_name: "home",
    library_size: await get_library_size(userID),
  };

  res.locals = page_data;
  res.render("index.ejs");
});

app.get("/search", (req, res) => {
  res.redirect("/");
});

app.post("/", async (req, res) => {
  const page_data = {
    page_name: "home",
    library_size: await get_library_size(),
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
  res.render("index.ejs");
});

app.post("/add", async (req, res) => {
  // Add an item to the user's library
  try {
    let selection = req.body["search_selection"];
    selection = selection.split(":");

    const selection_item = {
      type: selection[0],
      id: selection[1],
    };

    if (!selection_item || selection.length !== 2) {
      throw new Error("invalid input");
    }

    await add_item_details_db(selection_item.type, selection_item.id, userID);

    res.redirect("/library");
  } catch (error) {
    console.log(`Errored: ${error}`);
    res.redirect("/");
  }
});

app.get("/library", async (req, res) => {
  const page_data = {
    page_name: "library",
  };

  page_data.library_data = await get_library_data(userID);
  page_data.library_size = page_data.library_data.length;
  res.locals = page_data;

  res.render("library.ejs");
});

// TODO: add functions to modify the user's watch-list status? in library
// TODO: add functions to remove item from user's library?

app.get("/archive/:type/:id", async (req, res) => {
  const page_data = {
    page_name: "library",
    library_size: await get_library_size(userID),
  };

  const type = req.params["type"];
  const item_id = req.params["id"];
  page_data.type = type;
  page_data.id = item_id;
  page_data.item_data = await get_item_archive_data(type, item_id, userID);

  res.locals = page_data;
  res.render("archive_item.ejs");
});

// add functions to modify a user's data based on this page
app.post("/archive/:type/:id", async (req, res) => {
  const type = req.params["type"];
  const item_id = req.params["id"];
  const message = req.body["message"];

  try {
    await add_user_note(type, userID, item_id, message);
  } catch (error) {
    console.log(`Errored: ${error}`);
  }

  res.redirect(`/archive/${type}/${item_id}`);
});

app.post("/archive/:type/:id/put", async (req, res) => {
  const type = req.params["type"];
  const item_id = req.params["id"];

  const id = req.body["id"];
  const message = req.body["message"];

  try {
    await update_user_note(type, userID, id, message);
  } catch (error) {
    console.log(`Errored: ${error}`);
  }

  res.redirect(`/archive/${type}/${item_id}`);
});

app.post("/archive/:type/:id/delete", async (req, res) => {
  const type = req.params["type"];
  const item_id = req.params["id"];

  const id = req.body["id"];
  try {
    await delete_user_note(type, id, userID);
  } catch (error) {
    console.log(`Errored: ${error}`);
  }

  res.redirect(`/archive/${type}/${item_id}`);
});

app.get("/account", async (req, res) => {
  const page_data = {
    page_name: "account",
    library_size: await get_library_size(userID),
  };

  // TODO: add multiple account functionality later
  // TODO: add authentication to all paths for use in multiple accounts

  res.locals = page_data;
  res.render("account.ejs");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
