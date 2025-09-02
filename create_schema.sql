-- Remove tables if they exist prior to table (re)creation
drop table book_data cascade;
drop table book_authors cascade;
drop table authors cascade;
drop table book_images cascade;
drop table movie_tv_data cascade;
drop table movie_tv_genres cascade;
drop table movie_tv_images cascade;
drop table users cascade;
drop table user_notes_books cascade;
drop table user_books_list_categories cascade;
drop table user_notes_movies_tv cascade;
drop table user_movie_tv_list_categories cascade;
-- Tables:
create table book_data (
    book_id text primary key not null,
    title text not null,
    description text,
    series text,
    publish_date date
);
create table authors (
    author_id text primary key,
    author_name text not null,
    author_bio text
);
create table book_authors (
    book_id text references book_data(book_id),
    author_id text references authors(author_id),
    primary key (book_id, author_id)
);
create table book_images (
    book_id text references book_data(book_id),
    resource_url_location text,
    primary key (book_id, resource_url_location)
);
create table movie_tv_data (
    movie_tv_id text primary key not null,
    media_type text not null,
    -- movie or tvShow
    title text not null,
    start_year date not null,
    end_year date,
    plot text not null
);
create table movie_tv_genres (
    movie_tv_id text,
    genre text,
    primary key (movie_tv_id, genre)
);
create table movie_tv_images (
    movie_tv_id text references movie_tv_data(movie_tv_id),
    resource_url_location text,
    primary key (movie_tv_id, resource_url_location)
);
create table users (
    id SERIAL primary key,
    username text not null,
    password text not null
);
create table user_notes_books (
    note_id serial primary key,
    user_id integer references users(id) not null,
    book_id text references book_data(book_id) not null,
    note_content text not null
);
create table user_books_list_categories (
    -- when the user selects a book to add to their archive, add the book (may fail if already exists in the db), 
    --  then add a record here for the user and the book 
    user_id integer references users(id),
    book_id text references book_data(book_id),
    page_at integer not null DEFAULT 0,
    -- set to 0 by default
    on_reading_list boolean not null default false,
    has_read boolean not null default false,
    rating float check (
        rating = -1
        or rating <= 10
        and rating >= 0
    ) default -1,
    primary key (user_id, book_id)
);
create table user_notes_movies_tv (
    note_id serial primary key,
    user_id integer references users(id) not null,
    movie_tv_id text references movie_tv_data(movie_tv_id) not null,
    note_content text not null
);
create table user_movie_tv_list_categories (
    -- when the user selects a movie/tv show to add to their archive, add the movie/tv show (may fail if already exists in the db), 
    --  then add a record here for the user and the movie/tv show 
    user_id integer references users(id),
    movie_tv_id text references movie_tv_data(movie_tv_id),
    page_at integer not null DEFAULT 0,
    -- set to 0 by default
    on_reading_list boolean not null default false,
    has_read boolean not null default false,
    rating float check (
        rating = -1
        or rating <= 10
        and rating >= 0
    ) default -1,
    primary key (user_id, movie_tv_id)
);
-- Change the default username and default password prior to actual deployment
-- for version 2.0, add multiple user authentication
insert into users (id, username, password)
values (1, 'DEFAULT_USER', 'DEFAULT_PASSWORD');