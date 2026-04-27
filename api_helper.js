import axios from "axios";

export function formatted_date_string(input_string) {
  return new Date(new String(input_string)).toISOString().substring(0, 10);
}
// Get the basic information about a user's query (the multiple options of the search page query)
export async function get_api_response_base(search_query) {
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

export async function get_book_details_main(item_id) {
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
          await axios.get(`https://openlibrary.org/authors/${author_id}.json`)
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
    return [book_data, author_records, cover_image_urls];
  } catch (err) {
    throw new Error(err);
  }
}

export async function get_movie_tv_details_main(item_id, image_url) {
  try {
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
    let images_api_response = (await axios.get(MOVIE_TV_IMAGES_API_URL)).data;
    const image_urls = [];

    // Add the image URL of the search page's card
    image_urls.push(image_url);

    for (let image of images_api_response["images"]) {
      image_urls.push(image["url"]);
    }
    return [movie_tv_data, movie_tv_genres, image_urls];
  } catch (err) {
    throw new Error(err);
  }
}
