import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import dotenv from "dotenv";

const app = express();
const port = 3000;

// The userID in the database corresponding to the data for the logged-in user
// TODO: change the website to handle/authenticate different users
const userID = 1;

const environment = dotenv.config().parsed;

const db = new pg.Client({
  host: environment.POSTGRES_HOST,
  user: environment.POSTGRES_USER,
  port: environment.POSTGRES_PORT,
  password: environment.POSTGRES_PASSWORD,
  database: environment.POSTGRES_DB,
});

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", async (req, res) => {
  const page_data = {
    page_name: "home",
  };

  res.locals = page_data;
  res.render("index.ejs");
});

async function get_api_response(search_query) {
  // TODO: Do this method

  console.log(search_query);
  const type = search_query.type;

  // basic schema of output array:
  // array: [
  //     {
  //         type: "",
  //         id: "",
  //         title: "",
  //         year_start: "", // starting year of TV show, year movie was released, or publication date of book
  //         year_end : "", // may be null
  //         image: "" // image of media cover art
  //     }
  // ]

  switch (type) {
    case "Book":
      //   API call to book cover API
      return [];
      break;
    case "Movie_TV":
      // API call to imdb API
      return [];
      break;
    default:
      return [];
  }
}

app.post("/", async (req, res) => {
  const page_data = {
    page_name: "home",
  };
  try {
    const search_query = {
      type: req.body["query_type"],
      query: req.body["query_string"],
    };

    if (!search_query.type || !search_query.query) {
      throw new Error("invalid form inputs");
    }

    const search_results = await get_api_response(search_query);
    page_data.search_query = search_query;
    page_data.search_results = search_results;
  } catch (error) {
    console.log(`Errored: ${error}`);
  }
  console.log(page_data);
  res.locals = page_data;
  res.render("index.ejs");
});

async function add_item_details_db(type, item_id, userID) {
  // TODO: do this function
  //    make api call to get more details about the item
  //    add data to db, associate data with userID in another table
  //    catch errors of invalid input/response data retrieved from API call

  return 0;
}

app.post("/add", async (req, res) => {
  // Add an item to the user's library
  try {
    const selection = req.body["search_selection"].split(":");
    const selection_item = {
      type: selection[0],
      id: selection[1],
    };

    if (
      !selection_item ||
      !selection_item.type ||
      !selection_item.id ||
      selection.length > 2
    ) {
      throw new Error("invalid input");
    }

    //   TODO: add item to library for user with userID, add data about item to DB as well, using API call
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

  // add db fetch for all of the items in the user's library

  res.locals = page_data;
  res.render("library.ejs");
});

// add functions to modify the user's watch-list status? in library
// add functions to remove item from user's library?

app.get("/archive/type/:type/id/:id", async (req, res) => {
  const page_data = {
    page_name: "library",
  };

  // do fetch to get the user's notes / data regarding the specific item to be displayed

  res.locals = page_data;
  res.render("archive_item.ejs");
});

// add functions to modify a user's data based on this page

app.get("/account", async (req, res) => {
  const page_data = {
    page_name: "account",
  };

  // add db fetch for all of the items in the user's library

  res.locals = page_data;
  res.render("account.ejs");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
