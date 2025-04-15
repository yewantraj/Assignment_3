// Get the client
const mysql = require('mysql2');
require('dotenv').config()

// Create the connection to database
const pool = mysql.createPool({
    host: process.env.SQL_HOSTNAME,
    user: process.env.SQL_USERNAME,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DBNAME,
});

// Set up the API
const express = require('express')
var cors = require('cors');
const bodyParser = require('body-parser')
const app = express()
const port = 3001

// Make it available for public access
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    next();
});

app.use(cors());
app.options("*", cors());

app.set('json spaces', 2)
app.use(bodyParser.json({
    limit: "50mb"
}))
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
)

// Listen to outside connection
app.listen(port, () => {
    console.log(`App running on port ${port}. Control+C to exit.`)
})

// Root endpoint
app.get('/', (request, response) => {
    response.json(
        {
            info: 'Backend for Movie Database, set up by Chris K!'
        }
    )
})

// Users endpoints
app.get("/v1/users/list", (request, response) => {
    pool.query("SELECT id, fname, lname, email FROM users WHERE removed IS NULL ORDER BY id", [], (error, result) => {
        response.json(
            {
                status: "success",
                data: result
            }
        )
    });
})

app.get("/v1/users/get", (request, response) => {
    const id = request.query.id;
    pool.query("SELECT fname, lname, email FROM users WHERE id = ? AND removed IS NULL", [id], (error, result) => {
        response.json(
            {
                status: "success",
                data: result
            }
        )
    });
})

app.post("/v1/users/create", (request, response) => {
    const fname = request.body.fname;
    const lname = request.body.lname;
    const email = request.body.email;

    pool.query(
        "INSERT INTO users (fname, lname, email) VALUES (?, ?, ?)",
        [fname, lname, email], (error, result) => {
            response.json(
                {
                    status: "success",
                    message: "New user created"
                }
            )
        }
    )
})

app.post("/v1/users/remove", (request, response) => {
    const id = request.body.id;
    pool.query(
        "UPDATE users SET removed = 1 WHERE id = ?",
        [id], (error, result) => {
            response.json(
                {
                    status: "success",
                    message: "User removed"
                }
            )
        }
    )
})

// Directors endpoints
app.get("/v1/directors/list", (request, response) => {
    pool.query("SELECT id, fname, lname FROM directors ORDER BY id", [], (error, result) => {
        response.json(
            {
                status: "success",
                data: result
            }
        )
    });
})

app.get("/v1/directors/get", (request, response) => {
    const id = request.query.id;
    pool.query("SELECT fname, lname FROM directors WHERE id = ?", [id], (error, result) => {
        response.json(
            {
                status: "success",
                data: result
            }
        )
    });
})

// Actors endpoints
app.get("/v1/actors/list", (request, response) => {
    pool.query("SELECT id, fname, lname FROM actors ORDER BY id", [], (error, result) => {
        response.json(
            {
                status: "success",
                data: result
            }
        )
    });
})

app.get("/v1/actors/get", (request, response) => {
    const id = request.query.id;
    pool.query("SELECT fname, lname FROM actors WHERE id = ?", [id], (error, result) => {
        response.json(
            {
                status: "success",
                data: result
            }
        )
    });
})

// Genres endpoints
app.get("/v1/genres/list", (request, response) => {
    pool.query("SELECT id, name FROM genres ORDER BY name", [], (error, result) => {
        response.json(
            {
                status: "success",
                data: result
            }
        )
    });
})

// Movies endpoints
app.get("/v1/movies/list", (request, response) => {
    pool.query(
        `SELECT m.id, m.title, m.release_date, 
        CONCAT(d.fname, ' ', d.lname) as director, 
        g.name as genre 
        FROM movies m
        JOIN directors d ON m.director_id = d.id
        JOIN genres g ON m.genre_id = g.id
        ORDER BY m.release_date DESC`, 
        [], 
        (error, result) => {
            response.json(
                {
                    status: "success",
                    data: result
                }
            )
        }
    );
})

app.get("/v1/movies/get", (request, response) => {
    const id = request.query.id;
    pool.query(
        `SELECT m.id, m.title, m.release_date, 
        m.director_id, CONCAT(d.fname, ' ', d.lname) as director,
        m.genre_id, g.name as genre
        FROM movies m
        JOIN directors d ON m.director_id = d.id
        JOIN genres g ON m.genre_id = g.id
        WHERE m.id = ?`, 
        [id], 
        (error, result) => {
            if (error) {
                response.json({
                    status: "error",
                    message: error.message
                });
                return;
            }

            // Get actors for this movie
            pool.query(
                `SELECT a.id, CONCAT(a.fname, ' ', a.lname) as name
                FROM actors a
                JOIN movie_actors ma ON a.id = ma.actor_id
                WHERE ma.movie_id = ?`,
                [id],
                (actorError, actorResult) => {
                    if (actorError) {
                        response.json({
                            status: "error",
                            message: actorError.message
                        });
                        return;
                    }

                    if (result.length > 0) {
                        result[0].actors = actorResult;
                    }

                    response.json({
                        status: "success",
                        data: result
                    });
                }
            );
        }
    );
})

app.post("/v1/movies/create", (request, response) => {
    const { title, director_id, release_date, genre_id, actor_ids } = request.body;

    pool.query(
        "INSERT INTO movies (title, director_id, release_date, genre_id) VALUES (?, ?, ?, ?)",
        [title, director_id, release_date, genre_id], 
        (error, result) => {
            if (error) {
                response.json({
                    status: "error",
                    message: error.message
                });
                return;
            }

            const movieId = result.insertId;
            
            // Add actors if provided
            if (actor_ids && actor_ids.length > 0) {
                const actorValues = actor_ids.map(actorId => [movieId, actorId]);
                
                pool.query(
                    "INSERT INTO movie_actors (movie_id, actor_id) VALUES ?",
                    [actorValues],
                    (actorError, actorResult) => {
                        if (actorError) {
                            response.json({
                                status: "error",
                                message: actorError.message
                            });
                            return;
                        }
                        
                        response.json({
                            status: "success",
                            message: "New movie created with actors"
                        });
                    }
                );
            } else {
                response.json({
                    status: "success",
                    message: "New movie created"
                });
            }
        }
    );
})

// Watchlist endpoints
app.get("/v1/watchlist/list", (request, response) => {
    pool.query(
        `SELECT w.id, w.movie_id, m.title, w.user_id, 
        CONCAT(u.fname, ' ', u.lname) as user_name,
        w.watch_date, w.rating
        FROM watchlist w
        JOIN movies m ON w.movie_id = m.id
        JOIN users u ON w.user_id = u.id
        WHERE w.removed IS NULL
        ORDER BY w.watch_date DESC`, 
        [], 
        (error, result) => {
            response.json({
                status: "success",
                data: result
            });
        }
    );
})

app.get("/v1/watchlist/user", (request, response) => {
    const userId = request.query.user_id;
    
    pool.query(
        `SELECT w.id, w.movie_id, m.title, 
        w.watch_date, w.rating
        FROM watchlist w
        JOIN movies m ON w.movie_id = m.id
        WHERE w.user_id = ? AND w.removed IS NULL
        ORDER BY w.watch_date DESC`, 
        [userId], 
        (error, result) => {
            response.json({
                status: "success",
                data: result
            });
        }
    );
})

app.post("/v1/watchlist/add", (request, response) => {
    const { movie_id, user_id, watch_date, rating } = request.body;

    pool.query(
        "INSERT INTO watchlist (movie_id, user_id, watch_date, rating) VALUES (?, ?, ?, ?)",
        [movie_id, user_id, watch_date, rating], 
        (error, result) => {
            if (error) {
                response.json({
                    status: "error",
                    message: error.message
                });
                return;
            }
            
            response.json({
                status: "success",
                message: "Movie added to watchlist"
            });
        }
    );
})

app.post("/v1/watchlist/remove", (request, response) => {
    const id = request.body.id;
    
    pool.query(
        "UPDATE watchlist SET removed = 1 WHERE id = ?",
        [id], 
        (error, result) => {
            response.json({
                status: "success",
                message: "Entry removed from watchlist"
            });
        }
    );
})

app.post("/v1/watchlist/update", (request, response) => {
    const { id, watch_date, rating } = request.body;
    
    pool.query(
        "UPDATE watchlist SET watch_date = ?, rating = ? WHERE id = ? AND removed IS NULL",
        [watch_date, rating, id], 
        (error, result) => {
            if (error) {
                response.json({
                    status: "error",
                    message: error.message
                });
                return;
            }
            
            response.json({
                status: "success",
                message: "Watchlist entry updated"
            });
        }
    );
})