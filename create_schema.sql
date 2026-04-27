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
    password text not null,
    created_date date not null,
);
-- Updating that table:
-- alter table users
-- add column created_date date;
-- UPDATE users
-- SET created_date = NOW();
-- alter table  users alter column created_date set not null;
-- alter table users alter column created_date set default NOW();
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
    display_image_url text,
    -- TODO: make sure this works
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
--  Updating that table
-- 1. Add the column as nullable initially
-- ALTER TABLE user_books_list_categories
-- ADD COLUMN display_image_url TEXT;
-- -- 2. Backfill existing records. This is critical.
-- --    This example picks the first image URL alphabetically for each book_id.
-- UPDATE user_books_list_categories ublc
-- SET display_image_url = (
--     SELECT bi.resource_url_location
--     FROM book_images bi
--     WHERE bi.book_id = ublc.book_id
--     ORDER BY bi.resource_url_location
--     LIMIT 1
-- )
-- WHERE ublc.display_image_url IS NULL; -- Ensure we only update if not already set
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
    display_image_url text,
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
-- Updating that table
-- ALTER TABLE user_movie_tv_list_categories
-- ADD COLUMN display_image_url TEXT;
-- UPDATE user_movie_tv_list_categories umtlc
-- SET display_image_url = (
--     SELECT mti.resource_url_location
--     FROM movie_tv_images mti
--     WHERE mti.movie_tv_id = umtlc.movie_tv_id
--     ORDER BY mti.resource_url_location
--     LIMIT 1
-- )
-- WHERE umtlc.display_image_url IS NULL;