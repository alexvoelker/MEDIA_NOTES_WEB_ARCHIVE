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

async function get_library_size() {
  // TODO: Make call to db to see how large the user's library is (books + movies/TV elements)
  return -1;
}

app.get("/", async (req, res) => {
  const page_data = {
    page_name: "home",
    library_size: await get_library_size(),
  };

  res.locals = page_data;
  res.render("index.ejs");
});

// Get the basic information about a user's query (the multiple options of the search page query)
async function get_api_response_base(search_query) {
  const type = search_query.type;

  // basic schema of output array:
  // array: [
  //     {
  //         type: "",
  //         id: "",
  //         authors: "",
  //         title: "",
  //         year_start: "", // starting year of TV show, year movie was released, or publication date of book
  //         year_end : "", // may be null
  //         image: "" // image of media cover art
  //     }
  // ]

  let title = search_query.query;
  switch (type) {
    case "Book":
      //   API call to book cover API
      const API_BOOK_QUERY_URL = "https://openlibrary.org/search.json?q=";
      const API_COVER_URL = "https://covers.openlibrary.org/b/id/";
      try {
        title = title.replaceAll(" ", "+");
        const api_response = (await axios.get(`${API_BOOK_QUERY_URL}${title}`))
          .data;
        const response = [];

        // Limit the number of items in the response to just the first 50
        let specific_results = api_response["docs"].slice(0, 50);
        specific_results.forEach((element) => {
          const element_id = element["cover_i"];
          const authors = element["author_name"];
          if (element_id && authors) {
            const new_item = {
              type: "Book",
              id: element_id,
              authors: authors.join(", "),
              title: element["title"],
              year_start: element["first_publish_year"],
              year_end: null,
              image: `${API_COVER_URL}${element_id}-L.jpg`,
            };
            response.push(new_item);
          }
        });
        return response;
      } catch (error) {
        console.log(`Errored: ${error}`);
        return [];
      }
    case "Movie_TV":
      // API call to imdb API
      const API_MOVIE_TV_QUERY_URL =
        "https://api.imdbapi.dev/search/titles?query=";
      try {
        const api_response = (
          await axios.get(`${API_MOVIE_TV_QUERY_URL}${title}`)
        ).data;
        console.log(api_response);
        let specific_results = api_response["titles"];
        console.log(specific_results);

        const results = [];
        specific_results.forEach((element) => {
          const image = element["primaryImage"];
          if (image && image["url"]) {
            const new_item = {
              type: "Movie_TV",
              id: element["id"],
              authors: null,
              title: element["primaryTitle"],
              year_start: element["startYear"],
              endYear: element["endYear"],
              image: image["url"],
            };

            results.push(new_item);
          }
        });

        return results;
      } catch (error) {
        console.log(`Errored: ${error}`);
        return [];
      }

      return [];
    default:
      return [];
  }
}

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

async function add_item_details_db(type, item_id, userID) {
  // TODO: do this function
  //    make api call to get more details about the item
  //    add data to db, associate data with userID in another table
  //    catch errors of invalid input/response data retrieved from API call
  console.log(type, item_id, userID);
  switch (type) {
    case "Book":
      break;
    case "Movie_TV":
      break;
    default:
      throw new Error("Invalid input type");
  }
}

app.post("/add", async (req, res) => {
  // Add an item to the user's library
  try {
    let selection = req.body["search_selection"];
    console.log(selection);
    selection = selection.split(":");
    console.log(selection);

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
    library_size: await get_library_size(),
  };

  // TODO: add db fetch for all of the items in the user's library

  res.locals = page_data;
  // TODO: update library.ejs to display the elements in the user's library
  res.render("library.ejs");
});

// add functions to modify the user's watch-list status? in library
// add functions to remove item from user's library?

app.get("/archive/type/:type/id/:id", async (req, res) => {
  const page_data = {
    page_name: "library",
    library_size: await get_library_size(),
  };

  // TODO: do fetch to get the user's notes / data regarding the specific item to be displayed

  res.locals = page_data;
  res.render("archive_item.ejs");
});

// add functions to modify a user's data based on this page

app.get("/account", async (req, res) => {
  const page_data = {
    page_name: "account",
    library_size: await get_library_size(),
  };

  // TODO: add multiple account functionality later

  res.locals = page_data;
  res.render("account.ejs");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
