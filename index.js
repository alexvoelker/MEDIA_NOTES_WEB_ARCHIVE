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
  // Make call to db to see how large the user's library is (books + movies/TV elements)
  let book_library_size = await db.query(
    "select count(*) from user_books_list_categories where user_id = $1",
    [userID]
  );
  book_library_size = Number(book_library_size.rows[0].count);

  let movie_tv_library_size = await db.query(
    "select count(*) from user_movie_tv_list_categories where user_id = $1",
    [userID]
  );
  movie_tv_library_size = Number(movie_tv_library_size.rows[0].count);

  return book_library_size + movie_tv_library_size;
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
      const API_COVER_URL = "https://covers.openlibrary.org/b/olid/";
      try {
        title = title.replaceAll(" ", "+");
        const api_response = (await axios.get(`${API_BOOK_QUERY_URL}${title}`))
          .data;
        const response = [];

        // Limit the number of items in the response to just the first 50
        let specific_results = api_response["docs"].slice(0, 50);
        specific_results.forEach((element) => {
          const authors = element["author_name"];
          if (element["cover_i"] && element["cover_edition_key"] && authors) {
            const element_id = element["cover_edition_key"];
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
        let specific_results = api_response["titles"];

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

function formatted_date_string(input_string) {
  return new Date(input_string).toISOString().substring(0, 10);
}

async function add_item_details_db(type, item_id, userID) {
  // TODO: do this function
  //    make api call to get more details about the item
  //    add data to db, associate data with userID in another table
  //    catch errors of invalid input/response data retrieved from API call
  switch (type) {
    case "Book":
      try {
        // Get data about the individual book
        let BOOK_SEARCH_API_URL = `https://openlibrary.org/works/${item_id}.json`;
        let api_response = (await axios.get(BOOK_SEARCH_API_URL)).data;
        if (api_response["works"] && api_response["works"][0]["key"]) {
          item_id = api_response["works"][0]["key"].split("/");
          item_id = item_id[item_id.length - 1];
          BOOK_SEARCH_API_URL = `https://openlibrary.org/works/${item_id}.json`;
          api_response = (await axios.get(BOOK_SEARCH_API_URL)).data;
        }
        let publishing_date =
          api_response["publish_date"] || api_response["first_publish_date"];
        if (publishing_date) {
          publishing_date = formatted_date_string(publishing_date);
        }

        const book_data = {
          book_id: item_id,
          title: api_response["title"],
          description: api_response["description"],
          series: api_response["series"],
          publish_date: publishing_date,
        };

        // get data on each of the book's authors, there can be more than one
        let author_ids_raw = api_response["authors"];
        const author_records = [];

        if (author_ids_raw) {
          for (let author of author_ids_raw) {
            let key = author["author"]["key"].split("/");
            let author_id = key[key.length - 1];
            const author_data = (
              await axios.get(
                `https://openlibrary.org/authors/${author_id}.json`
              )
            ).data;
            const new_author_record = {};
            new_author_record.id = author_id;
            new_author_record.name = author_data["name"];
            if (author_data["bio"] && author_data["bio"]["value"]) {
              new_author_record.author_bio = author_data["bio"]["value"];
            }
            author_records.push(new_author_record);
          }
        }
        // console.log(book_data);

        // construct the image urls of each "cover" that the book has
        let cover_ids = api_response["covers"];
        const cover_image_urls = [];
        if (cover_ids) {
          cover_ids.forEach((id) => {
            cover_image_urls.push(
              `https://covers.openlibrary.org/b/id/${id}-L.jpg`
            );
          });
        }

        // insert data into the database

        // Insert into book_data table
        try {
          await db.query(
            "insert into book_data (book_id, title, description, series, publish_date) values ($1, $2, $3, $4, $5)",
            [
              book_data.book_id,
              book_data.title,
              book_data.description,
              book_data.series,
              book_data.publish_date,
            ]
          );
        } catch (error) {
          console.log(`Errored: ${error}`);
        }
        // Insert into authors table
        try {
          for (let author of author_records) {
            await db.query(
              "insert into authors (author_id, author_name, author_bio) values ($1, $2, $3)",
              [author.id, author.name, author.author_bio]
            );
          }
        } catch (error) {
          console.log(`Errored: ${error}`);
        }
        // Insert into book_authors table
        try {
          for (let author of author_records) {
            await db.query(
              "insert into book_authors (book_id, author_id) values ($1, $2)",
              [item_id, author.id]
            );
          }
        } catch (error) {
          console.log(`Errored: ${error}`);
        }
        // Insert into book_images table
        try {
          for (let image_url of cover_image_urls) {
            await db.query(
              "insert into book_images (book_id, resource_url_location) values ($1, $2)",
              [item_id, image_url]
            );
          }
        } catch (error) {
          console.log(`Errored: ${error}`);
        }

        // Make a record for user_books_list_categories -- connect the newly added book data to the user
        try {
          await db.query(
            "insert into user_books_list_categories (user_id, book_id) values ($1, $2)",
            [userID, item_id]
          );
        } catch (error) {
          console.log(`Errored: ${error}`);
        }
      } catch (error) {
        console.log(`Errored: ${error}`);
      }
      break;
    case "Movie_TV":
      try {
        // Get data about the individual book
        let MOVIE_TV_SEARCH_API_URL = `https://api.imdbapi.dev/titles/${item_id}`;
        let api_response = (await axios.get(MOVIE_TV_SEARCH_API_URL)).data;

        const movie_tv_data = {
          id: api_response["id"],
          type: api_response["type"],
          title: api_response["primaryTitle"],
          start_year: api_response["startYear"],
          end_year: api_response["endYear"], // this might be null
          plot: api_response["plot"],
        };

        const movie_tv_genres = api_response["genres"];

        // get the image urls
        let MOVIE_TV_IMAGES_API_URL = `https://api.imdbapi.dev/titles/${item_id}/images`;
        let images_api_response = (await axios.get(MOVIE_TV_IMAGES_API_URL))
          .data;
        const image_urls = [];
        for (let image of images_api_response["images"]) {
          image_urls.push(image["url"]);
        }
        // insert data into the database

        // Insert into movie_tv_data table
        try {
          if (movie_tv_data.end_year) {
            await db.query(
              "insert into movie_tv_data (movie_tv_id, media_type, title, start_year, end_year, plot) values ($1, $2, $3, $4, $5, $6)",
              [
                movie_tv_data.id,
                movie_tv_data.type,
                movie_tv_data.title,
                formatted_date_string(movie_tv_data.start_year),
                formatted_date_string(movie_tv_data.end_year),
                movie_tv_data.plot,
              ]
            );
          } else {
            await db.query(
              "insert into movie_tv_data (movie_tv_id, media_type, title, start_year, plot) values ($1, $2, $3, $4, $5)",
              [
                movie_tv_data.id,
                movie_tv_data.type,
                movie_tv_data.title,
                formatted_date_string(movie_tv_data.start_year),
                movie_tv_data.plot,
              ]
            );
          }
        } catch (error) {
          console.log(`Errored: ${error}`);
        }
        // Insert into genres table
        try {
          for (let genre of movie_tv_genres) {
            await db.query(
              "insert into movie_tv_genres (movie_tv_id, genre) values ($1, $2)",
              [movie_tv_data.id, genre]
            );
          }
        } catch (error) {
          console.log(`Errored: ${error}`);
        }
        // Insert into movie_tv_images table
        try {
          for (let image_url of image_urls) {
            await db.query(
              "insert into movie_tv_images (movie_tv_id, resource_url_location) values ($1, $2)",
              [movie_tv_data.id, image_url]
            );
          }
        } catch (error) {
          console.log(`Errored: ${error}`);
        }

        // Make a record for user_movie_tv_list_categories -- connect the newly added movie/tv data to the user
        try {
          await db.query(
            "insert into user_movie_tv_list_categories (user_id, movie_tv_id) values ($1, $2)",
            [userID, movie_tv_data.id]
          );
        } catch (error) {
          console.log(`Errored: ${error}`);
        }
      } catch (error) {
        console.log(`Errored: ${error}`);
      }
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

async function get_library_data() {
  // get the data from the database
  // Get all of the books associated with the user
  try {
    const compiled_results = [];

    const book_results = await db.query(
      `
        select * 
        from book_data 
        join user_books_list_categories 
        on book_data.book_id = user_books_list_categories.book_id 
        where user_id = $1;
        `,
      [userID]
    );

    for (let row of book_results.rows) {
      try {
        row.type = "Book";

        const image_data = await db.query(
          `select resource_url_location 
            from book_images 
            where book_id = $1 
            limit 1;`,
          [row.book_id]
        );
        row.cover_image_url = image_data.rows[0].resource_url_location;
        row.id = row.book_id;
        const authors = await db.query(
          `select author_name
            from authors 
            join book_authors 
            on authors.author_id = book_authors.author_id 
            where book_id = $1;`,
          [row.book_id]
        );
        row.authors = authors.rows.map((author) => author.author_name);

        compiled_results.push(row);
      } catch (error) {
        console.log(`Errored: ${error}`);
      }
    }

    // Add the movie/tv data into the list
    const movie_tv_results = await db.query(
      `select * 
        from movie_tv_data
        join user_movie_tv_list_categories
        on movie_tv_data.movie_tv_id = user_movie_tv_list_categories.movie_tv_id
        where user_id = $1;
        `,
      [userID]
    );

    for (let row of movie_tv_results.rows) {
      try {
        row.type = "Movie_TV";
        // get the row's cover image
        const cover_image = await db.query(
          `select resource_url_location 
            from movie_tv_images
            where movie_tv_id = $1 
            limit 1;`,
          [row.movie_tv_id]
        );
        row.cover_image_url = cover_image.rows[0].resource_url_location;
        row.id = row.movie_tv_id;
        // get genres of the row
        const genres = await db.query(
          `select genre 
            from movie_tv_genres
            where movie_tv_id = $1;`,
          [row.movie_tv_id]
        );

        row.genres = genres.rows.map((genre) => genre.genre);

        compiled_results.push(row);
      } catch (error) {
        console.log(`Errored: ${error}`);
      }
    }

    return compiled_results;
  } catch (error) {
    console.log(`Errored: ${error}`);
    return [];
  }
}

app.get("/library", async (req, res) => {
  const page_data = {
    page_name: "library",
  };

  page_data.library_data = await get_library_data();
  page_data.library_size = page_data.library_data.length;
  res.locals = page_data;

  console.log(page_data);
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
