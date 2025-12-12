import axios from "axios";

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
