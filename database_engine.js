import env from "dotenv";
import pg from "pg";
import {
  get_book_details_main,
  get_movie_tv_details_main,
  formatted_date_string,
} from "./api_helper.js";

env.config();
const environment = process.env;

const db = new pg.Client({
  host: environment.POSTGRES_HOST,
  user: environment.POSTGRES_USER,
  port: environment.POSTGRES_PORT,
  password: environment.POSTGRES_PASSWORD,
  database: environment.POSTGRES_DB,
});

export async function check_db_connection() {
  console.log("connecting to database...");
  await db.connect();
  return "database connection success!";
}

export async function get_library_size(userID) {
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

export async function add_item_details_db(type, item_id, userID, image_url) {
  //    make api call to get more details about the item
  //    add data to db, associate data with userID in another table
  //    catch errors of invalid input/response data retrieved from API call
  switch (type) {
    case "Book":
      // Get data on the individual book
      try {
        const [book_data, author_records, cover_image_urls] =
          await get_book_details_main(item_id);

        console.log(item_id, book_data, author_records, cover_image_urls);
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
          console.log(`book_data insert error: ${error}`);
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
          console.log(`authors insert error: ${error}`);
        }
        // Insert into book_authors table
        try {
          for (let author of author_records) {
            await db.query(
              "insert into book_authors (book_id, author_id) values ($1, $2)",
              [book_data.book_id, author.id]
            );
          }
        } catch (error) {
          console.log(`book_authors insert error: ${error}`);
        }
        // Insert into book_images table
        try {
          for (let image_url of cover_image_urls) {
            await db.query(
              "insert into book_images (book_id, resource_url_location) values ($1, $2)",
              [book_data.book_id, image_url]
            );
          }
        } catch (error) {
          console.log(`book_images insert error: ${error}`);
        }

        // Make a record for user_books_list_categories -- connect the newly added book data to the user
        try {
          await db.query(
            "insert into user_books_list_categories (user_id, book_id, display_image_url) values ($1, $2, $3)",
            [userID, book_data.book_id, cover_image_urls[0]]
          );
        } catch (error) {
          console.log(`user_book_list_categories insert error: ${error}`);
        }
      } catch (error) {
        console.log(`Errored: ${error}`);
      }
      break;
    case "Movie_TV":
      try {
        // Get data about the individual movie or tv show
        const [movie_tv_data, movie_tv_genres, image_urls] =
          await get_movie_tv_details_main(item_id, image_url);
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
          console.log(`movie_tv_data insert error: ${error}`);
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
          console.log(`movie_tv_genres insert error: ${error}`);
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
          console.log(`movie_tv_images insert error: ${error}`);
        }

        // Make a record for user_movie_tv_list_categories -- connect the newly added movie/tv data to the user
        try {
          await db.query(
            "insert into user_movie_tv_list_categories (user_id, movie_tv_id, display_image_url) values ($1, $2, $3)",
            [userID, movie_tv_data.id, image_urls[0]]
          );
        } catch (error) {
          console.log(`user_movie_tv_list_categories insert error: ${error}`);
        }
      } catch (error) {
        console.log(`Errored: ${error}`);
      }
      break;
    default:
      throw new Error("Invalid input type");
  }
}

export async function get_library_data(userID) {
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

        // const image_data = await db.query(
        //   `select resource_url_location
        //     from book_images
        //     where book_id = $1
        //     limit 1;`,
        //   [row.book_id]
        // );

        // row.cover_image_url = image_data.rows[0].resource_url_location;
        row.cover_image_url = row.display_image_url;
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
        // // get the row's cover image
        // const cover_image = await db.query(
        //   `select resource_url_location 
        //     from movie_tv_images
        //     where movie_tv_id = $1 
        //     limit 1;`,
        //   [row.movie_tv_id]
        // );
        // row.cover_image_url = cover_image.rows[0].resource_url_location;
        row.cover_image_url = row.display_image_url;

        row.id = row.movie_tv_id;
        // get genres of the row
        const genres = await db.query(
          `select genre 
            from movie_tv_genres
            where movie_tv_id = $1;`,
          [row.movie_tv_id]
        );

        row.genres = genres.rows.map((genre) => genre.genre);
        row.date_string = `(${new Date(row.start_year).getFullYear()}${
          row.media_type !== "movie" ? " — " : ""
        }${row.end_year ? new Date(row.end_year).getFullYear() : ""})`;

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

export async function get_item_archive_data(type, item_id, userID) {
  try {
    switch (type) {
      case "Book":
        const book_results = await db.query(
          `
        select * 
        from book_data 
        join user_books_list_categories 
        on book_data.book_id = user_books_list_categories.book_id 
        where user_id = $1 and book_data.book_id = $2;
        `,
          [userID, item_id]
        );

        if (book_results.rows.length !== 1) {
          throw new Error(
            `An invalid number of return rows were provided (get_item_archive_data): ${book_results.rows.length}`
          );
        }

        try {
          const item = book_results.rows[0];

          item.type = "Book";

          const image_data = await db.query(
            `select resource_url_location 
            from book_images 
            where book_id = $1`,
            [item.book_id]
          );
          item.image_urls = image_data.rows.map(
            (img) => img.resource_url_location
          );
          item.id = item.book_id;
          const authors = await db.query(
            `select author_name
            from authors 
            join book_authors 
            on authors.author_id = book_authors.author_id 
            where book_id = $1;`,
            [item.book_id]
          );
          item.authors = authors.rows.map((author) => author.author_name);

          const notes = await db.query(
            `select note_id, note_content 
            from user_notes_books
            where user_id = $1 and book_id = $2
            order by note_id`,
            [userID, item_id]
          );
          item.notes = notes.rows.map((note) => {
            return { id: note.note_id, content: note.note_content };
          });

          return item;
        } catch (error) {
          console.log(`Errored: ${error}`);
          break;
        }
      case "Movie_TV":
        const movie_tv_results = await db.query(
          `select * 
        from movie_tv_data
        join user_movie_tv_list_categories
        on movie_tv_data.movie_tv_id = user_movie_tv_list_categories.movie_tv_id
        where user_id = $1 and movie_tv_data.movie_tv_id = $2;
        `,
          [userID, item_id]
        );

        if (movie_tv_results.rows.length !== 1) {
          throw new Error(
            `An invalid number of return rows were provided (get_item_archive_data): ${movie_tv_results.rows.length}`
          );
        }

        try {
          const item = movie_tv_results.rows[0];
          item.type = "Movie_TV";
          // get the item's images
          const cover_image = await db.query(
            `select resource_url_location 
            from movie_tv_images
            where movie_tv_id = $1`,
            [item.movie_tv_id]
          );
          item.image_urls = cover_image.rows.map(
            (img) => img.resource_url_location
          );

          item.id = item.movie_tv_id;
          // get genres of the item
          const genres = await db.query(
            `select genre 
            from movie_tv_genres
            where movie_tv_id = $1;`,
            [item.movie_tv_id]
          );

          item.genres = genres.rows.map((genre) => genre.genre);

          const notes = await db.query(
            `select note_id, note_content 
            from user_notes_movies_tv
            where user_id = $1 and movie_tv_id = $2
            order by note_id`,
            [userID, item_id]
          );
          item.notes = notes.rows.map((note) => {
            return { id: note.note_id, content: note.note_content };
          });

          return item;
        } catch (error) {
          console.log(`Errored: ${error}`);
          break;
        }
      default:
        throw new Error(
          `Invalid input type provided to get_item_archive_data: ${type}`
        );
    }
  } catch (error) {
    console.log(`Errored: ${error}`);
    return null;
  }
}

export async function add_user_note(media_type, userID, item_id, message) {
  try {
    if (!message) {
      throw new Error("invalid POST request, no message content");
    }

    let response;

    switch (media_type) {
      case "Book":
        response = await db.query(
          `insert into user_notes_books (user_id, book_id, note_content) 
            values ($1, $2, $3)`,
          [userID, item_id, message]
        );
        break;
      case "Movie_TV":
        response = await db.query(
          `insert into user_notes_movies_tv (user_id, movie_tv_id, note_content) 
            values ($1, $2, $3)`,
          [userID, item_id, message]
        );
        break;
      default:
        throw new Error(
          `Invalid input type provided to POST '/archive/:type/:id' : ${media_type}`
        );
    }
  } catch (error) {
    console.log(`Errored: ${error}`);
  }
}

export async function update_user_note(media_type, userID, id, message) {
  try {
    if (!id || !message) {
      throw new Error("invalid PUT request, no message content or note id");
    }
    let response;

    switch (media_type) {
      case "Book":
        response = await db.query(
          `update user_notes_books
          set note_content = $1
          where note_id = $2 and user_id = $3`,
          [message, id, userID]
        );
        break;
      case "Movie_TV":
        response = await db.query(
          `update user_notes_movies_tv
          set note_content = $1
          where note_id = $2 and user_id = $3`,
          [message, id, userID]
        );
        break;
      default:
        throw new Error(
          `Invalid input type provided to PUT '/archive/:type/:id' : ${media_type}`
        );
    }
  } catch (error) {
    console.log(`Errored: ${error}`);
  }
}

export async function delete_user_note(media_type, id, userID) {
  try {
    if (!id) {
      throw new Error("invalid DELETE request, no note id");
    }
    let response;
    switch (media_type) {
      case "Book":
        response = await db.query(
          `delete from user_notes_books 
                where user_id = $1 and note_id = $2`,
          [userID, id]
        );
        break;
      case "Movie_TV":
        response = await db.query(
          `delete from user_notes_movies_tv 
                where user_id = $1 and note_id = $2`,
          [userID, id]
        );
        break;
      default:
        throw new Error(
          `Invalid input type provided to DELETE '/archive/:type/:id' : ${media_type}`
        );
    }
  } catch (error) {
    console.log(`Errored: ${error}`);
  }
}

export async function check_existing_user(username) {
  try {
    return await db.query("SELECT username FROM users WHERE username = $1", [
      username,
    ]);
  } catch (err) {
    console.log("error", err);
  }
}

export async function insert_new_user_in_db(username, password_hash) {
  try {
    return await db.query(
      "INSERT INTO users (username, password, created_date) VALUES ($1, $2, $3) RETURNING *",
      [username, password_hash, formatted_date_string(new Date())]
    );
  } catch (err) {
    console.log("error", err);
  }
}

export async function get_existing_user_details(username) {
  try {
    return await db.query(
      "SELECT id, username, password, created_date FROM users WHERE username = $1 ",
      [username]
    );
  } catch (err) {
    console.log("error", err);
  }
}
