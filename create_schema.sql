-- Tables:

create table book_data (
    book_id primary key not null, -- add a data type
    -- ...
);

create table book_authors (
    book_id references book_data(book_id), -- add a data type
    author_name text not null,
    primary key (book_id, author_name)
);

create table book_images (
    book_id references book_data(book_id); -- add a data type
    resource_url_location text,
    primary key (book_id, resource_location)
);

create table movie_tv_data (
    movie_tv_id primary key not null, -- add a data type
    -- ...
);

create table movie_tv_images (
    movie_tv_id references movie_tv_data(movie_tv_id), -- add a data type
    resource_url_location text,
    primary key (movie_tv_id, resource_location)
);

create table users (
    id SERIAL primary key,
    username text not null,
    password text not null
)

create table user_notes_books (
    user_id integer references users(id),
    book_id references book_data(book_id), -- add the data type of book_data PK
    note_content text not null,
    PRIMARY KEY (user_id, book_id)
);

create table user_books_list_categories ( 
    -- when the user selects a book to add to their archive, add the book (may fail if already exists in the db), 
    --  then add a record here for the user and the book 
    user_id integer references users(id),
    book_id references book_data(book_id), -- add data type of book_data PK
    page_at integer not null DEFAULT 0, -- set to 0 by default
    on_reading_list boolean not null default false,
    has_read boolean not null default false,
    rating float check (rating <= 10 and rating >= 0),
    primary key (user_id, book_id)
);

-- Change the default username and default password prior to actual deployment
-- for version 2.0, add multiple user authentication
insert into users (1, "DEFAULT_USER", "DEFAULT_PASSWORD");