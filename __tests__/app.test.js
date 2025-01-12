const db = require("../db/connection.js");
const testData = require("../db/data/test-data/index.js");
const seed = require("../db/seeds/seed.js");
const app = require("../app");
const request = require("supertest");
const bcrypt = require("bcrypt");
const { checkExists, checkExistsPost } = require("../utils/checkExists.js");
const { generateAccessToken } = require("../utils/generateAccessToken.js");

const auth = {};

beforeEach(async () => {
  await seed(testData);
  const hashedPassword = await bcrypt.hash("test", 1);
  await db.query(
    "INSERT INTO users (username, name, avatar_url, password ) VALUES ('authUser', 'testman', 'avatar', $1)",
    [hashedPassword]
  );
  const response = await request(app).post("/api/login").send({
    username: "authUser",
    password: "test"
  });
  (auth.token = response.body.user.token), (auth.username = "authUser");
});
afterAll(() => db.end());

describe("/api", () => {
  it("returns json file detailing all developed endpoints", () => {
    return request(app)
      .get("/api")
      .expect(200)
      .then(({ body }) => {
        for (let key in body) {
          expect(body[key].description).not.toBe(null);
        }
      });
  });
});

describe("/api/topics", () => {
  describe("GET", () => {
    it("get request to /api/topics will return a status 200 and an array of objects with each topic", () => {
      return request(app)
        .get("/api/topics")
        .expect(200)
        .then(({ body }) => {
          expect(Array.isArray(body.topics)).toBe(true);
          body.topics.forEach((topic) => {
            expect(topic).toEqual(
              expect.objectContaining({
                slug: expect.any(String),
                description: expect.any(String)
              })
            );
          });
        });
    });

    it("returns a 404 and a message when path is incorrect", () => {
      return request(app)
        .get("/api/topic")
        .expect(404)
        .catch((err) => console.log(err));
    });
  });
  describe("POST", () => {
    it("returns a 201 response and the newly created topic when receiving a valid topic object", () => {
      const topic = {
        slug: "dogs",
        description: "dogs are awesome"
      };
      return request(app)
        .post("/api/topics")
        .send(topic)
        .expect(201)
        .then(({ body }) => {
          expect(body).toEqual({
            slug: "dogs",
            description: "dogs are awesome"
          });
        });
    });
    it("returns a 400 and error message when receiving an invalid field", () => {
      const badTopic = {
        snail: "dogs",
        description: "dogs are awesome"
      };
      return request(app)
        .post("/api/topics")
        .send(badTopic)
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Invalid field body");
        });
    });
    it("returns a 400 and error message when receiving a null value", () => {
      const badTopic = {
        slug: null,
        description: "dogs are awesome"
      };
      return request(app)
        .post("/api/topics")
        .send(badTopic)
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Fields cannot be null values");
        });
    });
  });
});

describe("/api/articles/:articleId", () => {
  describe("GET", () => {
    it("server responds with 200 response and the test article", () => {
      return request(app)
        .get("/api/articles/1")
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual({
            article: {
              author: "butter_bridge",
              title: "Living in the shadow of a great man",
              article_id: 1,
              body: "I find this existence challenging",
              topic: "mitch",
              created_at: "2020-07-09T21:11:00.000Z",
              votes: 100,
              comment_count: 11
            }
          });
        });
    });
    it("comment_count value is 0 for articles that have no comments", () => {
      return request(app)
        .get("/api/articles/2")
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual({
            article: {
              author: "icellusedkars",
              title: "Sony Vaio; or, The Laptop",
              article_id: 2,
              body: "Call me Mitchell. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would buy a laptop about a little and see the codey part of the world. It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people’s hats off—then, I account it high time to get to coding as soon as I can. This is my substitute for pistol and ball. With a philosophical flourish Cato throws himself upon his sword; I quietly take to the laptop. There is nothing surprising in this. If they but knew it, almost all men in their degree, some time or other, cherish very nearly the same feelings towards the the Vaio with me.",
              topic: "mitch",
              created_at: "2020-10-16T06:03:00.000Z",
              votes: 0,
              comment_count: 0
            }
          });
        });
    });
    it("returns with 404 status and sends back message when trying to access an article that does not exist", () => {
      return request(app)
        .get("/api/articles/99999")
        .expect(404)
        .then(({ body }) => {
          expect(body.message).toBe("Resource not found");
        });
    });
    it("returns with 400 status and sends back message when trying to use invalid value for articleId parameter", () => {
      return request(app)
        .get("/api/articles/apple")
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Invalid input");
        });
    });
  });
  describe("PATCH", () => {
    describe("update votes in an article", () => {
      it("Returns a 200 status and the updated article when receiving positive vote", () => {
        const voteInc = { inc_votes: 10, username: auth.username };
        return request(app)
          .patch("/api/articles/1")
          .send(voteInc)
          .set("authorization", `Bearer ${auth.token}`)
          .expect(200)
          .then(({ body }) => {
            expect(body).toEqual({
              article: {
                author: "butter_bridge",
                title: "Living in the shadow of a great man",
                article_id: 1,
                body: "I find this existence challenging",
                topic: "mitch",
                created_at: "2020-07-09T21:11:00.000Z",
                votes: 110
              }
            });
          });
      });
      it("Returns a 200 status and the updated article when receiving negative vote", () => {
        const voteInc = { inc_votes: -150, username: auth.username };
        return request(app)
          .patch("/api/articles/1")
          .send(voteInc)
          .set("authorization", `Bearer ${auth.token}`)
          .expect(200)
          .then(({ body }) => {
            expect(body).toEqual({
              article: {
                author: "butter_bridge",
                title: "Living in the shadow of a great man",
                article_id: 1,
                body: "I find this existence challenging",
                topic: "mitch",
                created_at: "2020-07-09T21:11:00.000Z",
                votes: -50
              }
            });
          });
      });
      it("Returns a 200 status and the unchanged article when receiving an empty body", () => {
        const emptyBody = { username: auth.username };
        return request(app)
          .patch("/api/articles/1")
          .send(emptyBody)
          .set("authorization", `Bearer ${auth.token}`)
          .expect(200)
          .then(({ body }) => {
            expect(body).toEqual({
              article: {
                author: "butter_bridge",
                title: "Living in the shadow of a great man",
                article_id: 1,
                body: "I find this existence challenging",
                topic: "mitch",
                created_at: "2020-07-09T21:11:00.000Z",
                votes: 100
              }
            });
          });
      });

      it("returns with 404 status and sends back message when trying to update an article that does not exist", () => {
        const vote = { inc_votes: 40, username: auth.username };
        return request(app)
          .patch("/api/articles/99999")
          .send(vote)
          .set("authorization", `Bearer ${auth.token}`)
          .expect(404)
          .then(({ body }) => {
            expect(body.message).toBe("Resource not found");
          });
      });
      it("returns with 400 status and sends back message when trying to use invalid value for articleId parameter", () => {
        const vote = { inc_votes: 40, username: auth.username };
        return request(app)
          .patch("/api/articles/apple")
          .send(vote)
          .set("authorization", `Bearer ${auth.token}`)
          .expect(400)
          .then(({ body }) => {
            expect(body.message).toBe("Invalid input");
          });
      });
      it("returns with 400 status and psql error when trying to update with incorrect value data type", () => {
        const vote = { inc_votes: "honey", username: auth.username };
        return request(app)
          .patch("/api/articles/1")
          .send(vote)
          .set("authorization", `Bearer ${auth.token}`)
          .expect(400)
          .then(({ body }) => {
            expect(body.message).toBe("Invalid input");
          });
      });
      it("returns with 400 status and invalid field error when sending a body with the wrong field name", () => {
        const vote = { this_is_wrong: 1, username: auth.username };
        return request(app)
          .patch("/api/articles/1")
          .send(vote)
          .set("authorization", `Bearer ${auth.token}`)
          .expect(400)
          .then(({ body }) => {
            expect(body.message).toBe("Invalid field body");
          });
      });
    });
    describe("update body in an article", () => {
      it("returns a 200 status and an article with an updated body when receiving valid body and id", async () => {
        const tempAuth = await request(app).post("/api/login").send({
          username: "butter_bridge",
          password: "butter_bridge1"
        });

        const articleBody = {
          body: "This is some test text!",
          username: tempAuth.body.user.username
        };
        return request(app)
          .patch("/api/articles/1")
          .send(articleBody)
          .set("authorization", `Bearer ${tempAuth.body.user.token}`)
          .expect(200)
          .then(({ body }) => {
            expect(body.article.body).toBe("This is some test text!");
            expect(body).toEqual({
              article: {
                author: "butter_bridge",
                title: "Living in the shadow of a great man",
                article_id: 1,
                body: "This is some test text!",
                topic: "mitch",
                created_at: "2020-07-09T21:11:00.000Z",
                votes: 100
              }
            });
          });
      });
      it("returns a 200 status and an unchanged article when receiving an empty body", async () => {
        const tempAuth = await request(app).post("/api/login").send({
          username: "butter_bridge",
          password: "butter_bridge1"
        });
        const articleBody = { username: tempAuth.body.user.username };
        return request(app)
          .patch("/api/articles/1")
          .send(articleBody)
          .set("authorization", `Bearer ${tempAuth.body.user.token}`)
          .expect(200)
          .then(({ body }) => {
            expect(body.article.body).toBe("I find this existence challenging");
            expect(body).toEqual({
              article: {
                author: "butter_bridge",
                title: "Living in the shadow of a great man",
                article_id: 1,
                body: "I find this existence challenging",
                topic: "mitch",
                created_at: "2020-07-09T21:11:00.000Z",
                votes: 100
              }
            });
          });
      });
      it("returns a 404 status and an error message when entering an id that is valid but article does not exists", () => {
        const articleBody = {
          body: "This is some test text!",
          username: auth.username
        };
        return request(app)
          .patch("/api/articles/9999")
          .send(articleBody)
          .expect(404)
          .set("authorization", `Bearer ${auth.token}`)
          .then(({ body }) => {
            expect(body.message).toBe("Resource not found");
          });
      });
      it("returns a 400 status and an error message when trying to enter an invalid data type for article_id", () => {
        const articleBody = {
          body: "This is some test text!",
          username: auth.username
        };

        return request(app)
          .patch("/api/articles/apple")
          .send(articleBody)
          .set("authorization", `Bearer ${auth.token}`)
          .expect(400)
          .then(({ body }) => {
            expect(body.message).toBe("Invalid input");
          });
      });
      it("returns with 403 status and sends back message when trying to update an article that does not belong to logged i user", () => {
        const commentBody = {
          body: "this is some text",
          username: auth.username
        };
        return request(app)
          .patch("/api/articles/1")
          .send(commentBody)
          .set("authorization", `Bearer ${auth.token}`)
          .expect(403)
          .then((headers) => {
            expect(headers.text).toBe("Forbidden");
          });
      });
      it("returns with 401 status and sends back message when trying to update an article as a user without a token", () => {
        const commentBody = {
          body: "this is some text",
          username: "butter_bridge"
        };
        return request(app)
          .patch("/api/articles/1")
          .send(commentBody)
          .expect(401)
          .then((headers) => {
            expect(headers.text).toBe("Unauthorized");
          });
      });
      it("returns with 400 status and invalid field error when sending a body with the wrong field name", async () => {
        const tempAuth = await request(app).post("/api/login").send({
          username: "butter_bridge",
          password: "butter_bridge1"
        });
        const articleBody = {
          this_is_wrong: 1,
          body: "this is some text",
          username: tempAuth.body.user.username
        };
        return request(app)
          .patch("/api/articles/1")
          .send(articleBody)
          .set("authorization", `Bearer ${tempAuth.body.user.token}`)
          .expect(400)
          .then(({ body }) => {
            expect(body.message).toBe("Invalid field body");
          });
      });
    });
  });
  describe("DELETE", () => {
    it("returns a 204 status and deletes the article and comments for article specified articleId", async () => {
      const tempAuth = await request(app).post("/api/login").send({
        username: "butter_bridge",
        password: "butter_bridge1"
      });

      return request(app)
        .delete("/api/articles/1")
        .set("authorization", `Bearer ${tempAuth.body.user.token}`)
        .expect(204)
        .then((response) => {
          expect(response.body).toEqual({});
          const articleResult = db.query(
            "SELECT * FROM articles WHERE article_id = 1;"
          );

          return articleResult;
        })
        .then((articleResult) => {
          expect(articleResult.rows.length).toBe(0);
          const commentResult = db.query(
            "SELECT * FROM comments WHERE article_id = 1;"
          );
          return commentResult;
        })
        .then((commentResult) => {
          expect(commentResult.rows.length).toBe(0);
        });
    });
    it("returns a 401 error and returns an unauthorized message when trying to delete an article that does not belong to user", async () => {
      const tempAuth = await request(app).post("/api/login").send({
        username: "icellusedkars",
        password: "icellusedkars1"
      });

      return request(app)
        .delete("/api/articles/1")
        .set("authorization", `Bearer ${tempAuth.body.user.token}`)
        .expect(401)
        .then((headers) => {
          expect(headers.text).toBe("Unauthorized");
        });
    });
    it("returns a 400 error when using wrong data type for articleId parameter", async () => {
      const tempAuth = await request(app).post("/api/login").send({
        username: "butter_bridge",
        password: "butter_bridge1"
      });

      return request(app)
        .delete("/api/articles/orange")
        .set("authorization", `Bearer ${tempAuth.body.user.token}`)
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Invalid input");
        });
    });
    it("returns a 404 error when trying to delete an article that does not exists", async () => {
      const tempAuth = await request(app).post("/api/login").send({
        username: "butter_bridge",
        password: "butter_bridge1"
      });
      return request(app)
        .delete("/api/articles/999999")
        .set("authorization", `Bearer ${tempAuth.body.user.token}`)
        .expect(404)
        .then(({ body }) => {
          expect(body.message).toBe("Resource not found");
        });
    });
  });
});

describe("/api/articles", () => {
  describe("GET", () => {
    describe("Ordering and sortby", () => {
      describe("General use testing", () => {
        it("returns a 200 response and an array of article objects when no parameters given", () => {
          return request(app)
            .get("/api/articles")
            .expect(200)
            .then(({ body }) => {
              expect(Array.isArray(body.articles)).toBe(true);
              expect(body.articles.length > 0).toBe(true);
              body.articles.forEach((article) => {
                expect(article).toEqual(
                  expect.objectContaining({
                    author: expect.any(String),
                    title: expect.any(String),
                    article_id: expect.any(Number),
                    topic: expect.any(String),
                    created_at: expect.any(String),
                    votes: expect.any(Number),
                    comment_count: expect.any(Number),
                    total_count: expect.any(Number)
                  })
                );
              });
            });
        });
        it("By default function returns an array sorted by created_at in descending order", () => {
          return request(app)
            .get("/api/articles")
            .expect(200)
            .then(({ body }) => {
              expect(body.articles).toBeSortedBy("created_at", {
                descending: true
              });
            });
        });
        it("function sorts by provided sort_by query param in descending order", () => {
          return request(app)
            .get("/api/articles?sort_by=article_id")
            .expect(200)
            .then(({ body }) => {
              expect(body.articles).toBeSortedBy("article_id", {
                descending: true
              });
            });
        });
        it("function sorts by created_at in order of provided order query param", () => {
          return request(app)
            .get("/api/articles?order=asc")
            .expect(200)
            .then(({ body }) => {
              expect(body.articles).toBeSortedBy("created_at");
            });
        });
        it("function sorts by both sortBy and in order of provided query params", () => {
          return request(app)
            .get("/api/articles?sort_by=votes&order=asc")
            .expect(200)
            .then(({ body }) => {
              expect(body.articles).toBeSortedBy("votes");
            });
        });
      });
      describe("Error testing", () => {
        it("Function returns a 400 and an error message when provided a sort_by field that does not exist", () => {
          return request(app)
            .get("/api/articles?sort_by=apple")
            .expect(400)
            .then(({ body }) => {
              expect(body.message).toBe("Invalid sort field");
            });
        });
        it("Function returns a 400 and an error message when provided an invalid order value", () => {
          return request(app)
            .get("/api/articles?order=lemon")
            .expect(400)
            .then(({ body }) => {
              expect(body.message).toBe("Invalid order field");
            });
        });
      });
    });
    describe("Pagination", () => {
      it("by default the endpoint will return 10 results and does not have any offsets", () => {
        return request(app)
          .get("/api/articles?sort_by=article_id&order=asc")
          .expect(200)
          .then(({ body }) => {
            expect(body.articles.length).toBe(10);
            body.articles.forEach((article) => {
              expect(article.article_id < 11).toBe(true);
            });
          });
      });
      it("endpoint will return results specified by limit paramter ", () => {
        return request(app)
          .get("/api/articles?limit=7")
          .expect(200)
          .then(({ body }) => {
            expect(body.articles.length).toBe(7);
          });
      });
      it("endpoint will offset results specified by p parameter", () => {
        return request(app)
          .get("/api/articles?p=3&limit=2&sort_by=article_id&order=asc")
          .expect(200)
          .then(({ body }) => {
            expect(body.articles.length).toBe(2);
            body.articles.forEach((article) => {
              expect(article.article_id === 5 || article.article_id === 6).toBe(
                true
              );
            });
          });
      });
      it("endpoint will give default limit value if limit has an incorrect data type", () => {
        return request(app)
          .get("/api/articles?limit=butter")
          .expect(200)
          .then(({ body }) => {
            expect(body.articles.length).toBe(10);
          });
      });
      it("endpoint will give first page if offset value has an incorrect data type", () => {
        return request(app)
          .get("/api/articles?p=berry&limit=2&sort_by=article_id&order=asc")
          .expect(200)
          .then(({ body }) => {
            expect(body.articles.length).toBe(2);
            body.articles.forEach((article) => {
              expect(article.article_id === 1 || article.article_id === 2).toBe(
                true
              );
            });
          });
      });
      it("total_count parameter does not change when limit field is used as long as no other filter is present", () => {
        return request(app)
          .get("/api/articles?limit=3")
          .expect(200)
          .then(({ body }) => {
            expect(body.articles.length).toBe(3);
            body.articles.forEach((article) => {
              expect(article.total_count).toBe(12);
            });
          });
      });
    });
    describe("Filtering by topic", () => {
      it("function returns a 200 response and an array of articles object with filtered topic", () => {
        return request(app)
          .get("/api/articles?topic=mitch")
          .expect(200)
          .then(({ body }) => {
            body.articles.forEach((article) => {
              expect(article.topic).toBe("mitch");
            });
          });
      });
      it("function returns a 200 response and an empty array when provided with a valid topic that has no linked articles", () => {
        return request(app)
          .get("/api/articles?topic=paper")
          .expect(200)
          .then(({ body }) => {
            expect(body.articles.length).toBe(0);
            expect(body.articles).toEqual([]);
          });
      });
      it("function returns a 404 response and an error message when providing invalid topic value", () => {
        return request(app)
          .get("/api/articles?topic=milk")
          .expect(404)
          .then(({ body }) => {
            expect(body.message).toBe("Resource not found");
          });
      });
      it("total_count parameter will change depending on filtered topic", () => {
        return request(app)
          .get("/api/articles?topic=mitch")
          .expect(200)
          .then(({ body }) => {
            body.articles.forEach((article) => {
              expect(article.total_count).toBe(11);
            });
          });
      });
    });
    describe("Search", () => {
      it("query returns a status of 200 and a selection of titles when given articles that contain a matched str", () => {
        return request(app)
          .get("/api/articles?search=pred")
          .expect(200)
          .then(({ body }) => {
            body.articles.forEach((article) => {
              expect(article).toEqual(
                expect.objectContaining({
                  author: expect.any(String),
                  title: expect.stringContaining("pred"),
                  article_id: expect.any(Number),
                  topic: expect.any(String),
                  created_at: expect.any(String),
                  votes: expect.any(Number),
                  comment_count: expect.any(Number),
                  total_count: expect.any(Number)
                })
              );
            });
          });
      });

      it("query returns a status of 404 message when no topic has the contained string", () => {
        return request(app)
          .get("/api/articles?search=somewhereovertherainbow")
          .expect(404)
          .then(({ body }) => {
            expect(body.message).toBe("Resource not found");
          });
      });
    });
    it("function can use all query params and sends back a 200 response with an array of articles", () => {
      return request(app)
        .get("/api/articles?sort_by=article_id&topic=mitch&order=asc")
        .expect(200)
        .then(({ body }) => {
          expect(Array.isArray(body.articles)).toBe(true);
          expect(body.articles.length > 0).toBe(true);
          expect(body.articles).toBeSortedBy("article_id");
          body.articles.forEach((article) => {
            expect(article.topic).toBe("mitch");
          });
        });
    });
  });
  describe("POST", () => {
    it("returns a status of 201 and a new article when receiving a valid article body", () => {
      const newArticle = {
        author: "authUser",
        title: "Posting is fun!",
        body: "Posting is the new getting! By posting you create new....",
        topic: "cats"
      };

      return request(app)
        .post("/api/articles")
        .set("Authorization", `Bearer ${auth.token}`)
        .send(newArticle)
        .expect(201)
        .then(({ body }) => {
          expect(body).toEqual({
            article: {
              author: "authUser",
              title: "Posting is fun!",
              body: "Posting is the new getting! By posting you create new....",
              topic: "cats",
              article_id: 13,
              votes: 0,
              created_at: expect.any(String),
              comment_count: 0
            }
          });
        });
    });
    it("returns a status of 400 and an error message when receiving an article body with an invalid key", () => {
      const badArticleBody = {
        fakekey: "evil",
        author: "authUser",
        title: "Posting is fun!",
        body: "Posting is the new getting! By posting you create new....",
        topic: "cats"
      };

      return request(app)
        .post("/api/articles")
        .set("Authorization", `Bearer ${auth.token}`)
        .send(badArticleBody)
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Invalid field body");
        });
    });
    it("returns a status of 403 and an error message when receiving an author value that does not exist", () => {
      const badArticleBody = {
        author: "JK Rowling",
        title: "Posting is fun!",
        body: "Posting is the new getting! By posting you create new....",
        topic: "cats"
      };

      return request(app)
        .post("/api/articles")
        .set("Authorization", `Bearer ${auth.token}`)
        .send(badArticleBody)
        .expect(403)
        .then((body) => {
          expect(body.text).toBe("Forbidden");
        });
    });
    it("returns a status of 400 and an error message when receiving a topic value that does not exist", () => {
      const badArticleBody = {
        author: "authUser",
        title: "Posting is fun!",
        body: "Posting is the new getting! By posting you create new....",
        topic: "dogs"
      };

      return request(app)
        .post("/api/articles")
        .set("Authorization", `Bearer ${auth.token}`)
        .send(badArticleBody)
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Value/s violate foreign key restraint");
        });
    });
    it("returns a status of 400 and an error message when receiving null values in body", () => {
      const badArticleBody = {
        author: "authUser",
        title: "Posting is fun!",
        body: null,
        topic: "dogs"
      };

      return request(app)
        .post("/api/articles")
        .set("Authorization", `Bearer ${auth.token}`)
        .send(badArticleBody)
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Fields cannot be null values");
        });
    });
  });
});

describe("/api/articles/:articleId/comments", () => {
  describe("GET", () => {
    describe("general use testing", () => {
      it("returns a status of 200 and an array of comments for provided article id", () => {
        return request(app)
          .get("/api/articles/1/comments")
          .expect(200)
          .then(({ body }) => {
            expect(Array.isArray(body.comments)).toBe(true);
            expect(body.comments.length > 1).toBe(true);
            body.comments.forEach((comment) => {
              expect(comment).toEqual(
                expect.objectContaining({
                  comment_id: expect.any(Number),
                  votes: expect.any(Number),
                  created_at: expect.any(String),
                  author: expect.any(String),
                  body: expect.any(String)
                })
              );
            });
          });
      });
      it("returns a status of 200 and an empty array of comments when article contains 0 comments", () => {
        return request(app)
          .get("/api/articles/7/comments")
          .expect(200)
          .then(({ body }) => {
            expect(Array.isArray(body.comments)).toBe(true);
            expect(body.comments.length === 0).toBe(true);
          });
      });
      it("returns with 404 status and sends back message when trying to access comments on an article that does not exist", () => {
        return request(app)
          .get("/api/articles/99999/comments")
          .expect(404)
          .then(({ body }) => {
            expect(body.message).toBe("Resource not found");
          });
      });
      it("returns with 400 status and sends back message when trying to use invalid value for articleId parameter", () => {
        return request(app)
          .get("/api/articles/apple/comments")
          .expect(400)
          .then(({ body }) => {
            expect(body.message).toBe("Invalid input");
          });
      });
    });
    describe("Pagination", () => {
      it("by default the endpoint will return 10 results and does not have any offsets", () => {
        return request(app)
          .get("/api/articles/1/comments")
          .expect(200)
          .then(({ body }) => {
            expect(body.comments.length).toBe(10);
          });
      });
      it("endpoint will return results specified by limit paramter ", () => {
        return request(app)
          .get("/api/articles/1/comments?limit=3")
          .expect(200)
          .then(({ body }) => {
            expect(body.comments.length).toBe(3);
          });
      });
      it("endpoint will offset results specified by p parameter", () => {
        return request(app)
          .get("/api/articles/1/comments?p=2&limit=10")
          .expect(200)
          .then(({ body }) => {
            expect(body.comments.length).toBe(1);
          });
      });
      it("endpoint will give default limit value if limit has an incorrect data type", () => {
        return request(app)
          .get("/api/articles/1/comments?limit=grapefruit")
          .expect(200)
          .then(({ body }) => {
            expect(body.comments.length).toBe(10);
          });
      });
      it("endpoint will give first page if offset value has an incorrect data type", () => {
        return request(app)
          .get("/api/articles/1/comments?p=berry&limit=11")
          .expect(200)
          .then(({ body }) => {
            expect(body.comments.length).toBe(11);
          });
      });
    });
    describe("ordering", () => {
      it("By default the function returns an array sorted by created_at in descending order", () => {
        return request(app)
          .get("/api/articles/1/comments")
          .expect(200)
          .then(({ body }) => {
            expect(body.comments).toBeSortedBy("created_at", {
              descending: true
            });
          });
      });
      it("function sorts by provided sort_by query param in descending order", () => {
        return request(app)
          .get("/api/articles/1/comments?sort_by=votes")
          .expect(200)
          .then(({ body }) => {
            expect(body.comments).toBeSortedBy("votes", {
              descending: true
            });
          });
      });
      it("function sorts by created_at in order of provided order query param", () => {
        return request(app)
          .get("/api/articles/1/comments?order=asc")
          .expect(200)
          .then(({ body }) => {
            expect(body.comments).toBeSortedBy("created_at");
          });
      });
      it("function sorts by both sortBy and in order of provided query params", () => {
        return request(app)
          .get("/api/articles/1/comments?sort_by=votes&order=asc")
          .expect(200)
          .then(({ body }) => {
            expect(body.comments).toBeSortedBy("votes");
          });
      });
      describe("Error testing", () => {
        it("Function returns a 400 and an error message when provided a sort_by field that does not exist", () => {
          return request(app)
            .get("/api/articles/1/comments?sort_by=apple")
            .expect(400)
            .then(({ body }) => {
              expect(body.message).toBe("Invalid sort field");
            });
        });
        it("Function returns a 400 and an error message when provided an invalid order value", () => {
          return request(app)
            .get("/api/articles/1/comments?order=lemon")
            .expect(400)
            .then(({ body }) => {
              expect(body.message).toBe("Invalid order field");
            });
        });
      });
    });
  });
  describe("POST", () => {
    it("returns a 201 status and the newly created comment when passed an authorized user", () => {
      const newComment = {
        username: "authUser",
        body: "This is a test"
      };

      return request(app)
        .post("/api/articles/1/comments")
        .set("authorization", `Bearer ${auth.token}`)
        .send(newComment)
        .expect(201)
        .then(({ body }) => {
          expect(body).toEqual(
            expect.objectContaining({
              comment: {
                comment_id: expect.any(Number),
                author: newComment.username,
                article_id: 1,
                votes: 0,
                created_at: expect.any(String),
                body: newComment.body
              }
            })
          );
        });
    });
    it("returns a 400 status when sending a body that contains a key that is invalid", () => {
      const badComment = {
        username: "authUser",
        bodyy: "This is a test"
      };

      return request(app)
        .post("/api/articles/1/comments")
        .set("authorization", `Bearer ${auth.token}`)
        .send(badComment)
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Invalid field body");
        });
    });
    it("returns a 404 status when sending a post request to an article that does not exist but has a valid article id", () => {
      const comment = {
        username: "authUser",
        body: "This is a test"
      };

      return request(app)
        .post("/api/articles/1234/comments")
        .set("authorization", `Bearer ${auth.token}`)
        .send(comment)
        .expect(404)
        .then(({ body }) => {
          expect(body.message).toBe("Resource not found");
        });
    });
    it("returns a 400 status when sending a post request with a null value", () => {
      const badComment = {
        username: "authUser",
        body: null
      };

      return request(app)
        .post("/api/articles/1/comments")
        .set("authorization", `Bearer ${auth.token}`)
        .send(badComment)
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Fields cannot be null values");
        });
    });
    it("returns a 401 status when sending a post request with a username that does not exist", () => {
      const badComment = {
        username: "fakeName",
        body: "Something to write about"
      };

      return request(app)
        .post("/api/articles/1/comments")
        .send(badComment)
        .expect(401)
        .then((headers) => {
          expect(headers.text).toBe("Unauthorized");
        });
    });
    it("returns a 400 status when sending a post request with an invalid value for article_id", () => {
      const comment = {
        username: "authUser",
        body: "This is a test"
      };

      return request(app)
        .post("/api/articles/apple/comments")

        .set("authorization", `Bearer ${auth.token}`)
        .send(comment)
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Invalid input");
        });
    });
  });
});

describe("/api/comments", () => {
  describe("GET", () => {
    it("returns a status of 200 and an array of comment objects", () => {
      return request(app)
        .get("/api/comments")
        .expect(200)
        .then(({ body }) => {
          expect(Array.isArray(body.comments)).toBe(true);
          body.comments.forEach((comment) => {
            expect(comment).toEqual(
              expect.objectContaining({
                author: expect.any(String),
                article_id: expect.any(Number),
                votes: expect.any(Number),
                created_at: expect.any(String),
                body: expect.any(String)
              })
            );
          });
        });
    });
    it("returns a status of 404 when path is incorrect", () => {
      return request(app)
        .get("/api/comment")
        .expect(404)
        .then(({ body }) => {
          expect(body.message).toBe("Path not found");
        });
    });
  });
});

describe("/api/comments/:commentId", () => {
  describe("DELETE", () => {
    it("returns a 204 status and no body when deleting valid comment", async () => {
      const tempAuth = await request(app).post("/api/login").send({
        username: "butter_bridge",
        password: "butter_bridge1"
      });

      return request(app)
        .delete("/api/comments/1")
        .set("authorization", `Bearer ${tempAuth.body.user.token}`)
        .expect(204)
        .then((response) => {
          expect(response.body).toEqual({});
          return db.query("SELECT * FROM comments WHERE comment_id = 1");
        })
        .then((result) => {
          expect(result.rows.length).toBe(0);
        });
    });
    it("returns a 404 status and an error message when attempting to delete a comment that does not exist", async () => {
      return request(app)
        .delete("/api/comments/999999")
        .set("authorization", `Bearer ${auth.token}`)
        .expect(404)
        .then(({ body }) => {
          expect(body.message).toBe("Resource not found");
        });
    });
    it("returns a 400 status and an error message when attempting to delete a comment that has the wrong data type for commentId", () => {
      return request(app)
        .delete("/api/comments/apple")
        .set("authorization", `Bearer ${auth.token}`)
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Invalid input");
        });
    });
  });
  describe("PATCH", () => {
    describe("update votes on a comment", () => {
      it("returns a 200 and the comment with updated postive vote amount", () => {
        const voteInc = {
          inc_votes: 2,
          username: auth.username
        };
        return request(app)
          .patch("/api/comments/1")
          .send(voteInc)
          .set("Authorization", `Bearer ${auth.token}`)
          .expect(200)
          .then(({ body }) => {
            expect(body).toEqual({
              comment: {
                comment_id: 1,
                author: "butter_bridge",
                article_id: 9,
                votes: 18,
                created_at: "2020-04-06T13:17:00.000Z",
                body: "Oh, I've got compassion running out of my nose, pal! I'm the Sultan of Sentiment!"
              }
            });
          });
      });
      it("returns a 200 and the comment with updated negative vote amount", () => {
        const voteInc = {
          inc_votes: -6,
          username: auth.username
        };
        return request(app)
          .patch("/api/comments/1")
          .send(voteInc)
          .set("Authorization", `Bearer ${auth.token}`)
          .expect(200)
          .then(({ body }) => {
            expect(body).toEqual({
              comment: {
                comment_id: 1,
                author: "butter_bridge",
                article_id: 9,
                votes: 10,
                created_at: "2020-04-06T13:17:00.000Z",
                body: "Oh, I've got compassion running out of my nose, pal! I'm the Sultan of Sentiment!"
              }
            });
          });
      });

      it("returns a 200 and the comment when a body that has no voteInc is received", () => {
        const voteInc = { username: auth.username };
        return request(app)
          .patch("/api/comments/1")
          .send(voteInc)
          .set("Authorization", `Bearer ${auth.token}`)
          .expect(200)
          .then(({ body }) => {
            expect(body).toEqual({
              comment: {
                comment_id: 1,
                author: "butter_bridge",
                article_id: 9,
                votes: 16,
                created_at: "2020-04-06T13:17:00.000Z",
                body: "Oh, I've got compassion running out of my nose, pal! I'm the Sultan of Sentiment!"
              }
            });
          });
      });
      it("returns a 404 and a message when given a commentId that does not exist", () => {
        const voteInc = {
          inc_votes: -6,
          username: auth.username
        };

        return request(app)
          .patch("/api/comments/123578")
          .send(voteInc)
          .set("Authorization", `Bearer ${auth.token}`)
          .expect(404)
          .then(({ body }) => {
            expect(body.message).toBe("Resource not found");
          });
      });
      it("returns a 400 and a message when given a commentId that has the incorrect data type", () => {
        const voteInc = {
          inc_votes: 3,
          username: auth.username
        };

        return request(app)
          .patch("/api/comments/apple")
          .send(voteInc)
          .set("Authorization", `Bearer ${auth.token}`)
          .expect(400)
          .then(({ body }) => {
            expect(body.message).toBe("Invalid input");
          });
      });
      it("returns a 400 and a message when given the wrong body key", () => {
        const badVoteInc = {
          inc_votes_bad: 3,
          username: auth.username
        };

        return request(app)
          .patch("/api/comments/1")
          .send(badVoteInc)
          .set("Authorization", `Bearer ${auth.token}`)
          .expect(400)
          .then(({ body }) => {
            expect(body.message).toBe("Invalid field body");
          });
      });
      it("returns a 400 and a psql error message when given the wrong body value data type", () => {
        const badVoteInc = {
          inc_votes: "apple",
          username: auth.username
        };

        return request(app)
          .patch("/api/comments/1")
          .send(badVoteInc)
          .set("Authorization", `Bearer ${auth.token}`)
          .expect(400)
          .then(({ body }) => {
            expect(body.message).toBe("Invalid input");
          });
      });
      it("returns a 400 and a message when inc_votes is null", () => {
        const nullVoteInc = {
          inc_votes: null,
          username: auth.username
        };

        return request(app)
          .patch("/api/comments/1")
          .send(nullVoteInc)
          .set("Authorization", `Bearer ${auth.token}`)
          .expect(400)
          .then(({ body }) => {
            expect(body.message).toBe("Fields cannot be null values");
          });
      });
      it("returns a 401 and a forbidden message when trying to vote without a token", () => {
        const voteInc = {
          inc_votes: 1,
          username: auth.username
        };

        return request(app)
          .patch("/api/comments/1")
          .send(voteInc)
          .expect(401)
          .then((headers) => {
            expect(headers.text).toBe("Unauthorized");
          });
      });
      it("returns a 403 and an unauthorized message when trying to vote with a username that does not match the token", () => {
        const voteInc = {
          inc_votes: 1,
          username: "badname"
        };

        return request(app)
          .patch("/api/comments/1")
          .send(voteInc)
          .set("authorization", `Bearer ${auth.token}`)
          .expect(403)
          .then((headers) => {
            expect(headers.text).toBe("Forbidden");
          });
      });
    });
    describe("update body on a comment", () => {
      it("updates body for a comment and responds with a 200 response", async () => {
        const tempAuth = await request(app).post("/api/login").send({
          username: "butter_bridge",
          password: "butter_bridge1"
        });

        const newCommentBody = {
          body: "This is a great comment!",
          username: tempAuth.body.user.username
        };

        return request(app)
          .patch("/api/comments/1")
          .send(newCommentBody)
          .set("authorization", `Bearer ${tempAuth.body.user.token}`)
          .expect(200)
          .then(({ body }) => {
            expect(body.comment.body).toBe("This is a great comment!");
            expect(body).toEqual({
              comment: {
                article_id: 9,
                author: "butter_bridge",
                body: "This is a great comment!",
                comment_id: 1,
                created_at: "2020-04-06T13:17:00.000Z",
                votes: 16
              }
            });
          });
      });

      it("returns a 400 when attempting to send a body with a key that is invalid", async () => {
        const tempAuth = await request(app).post("/api/login").send({
          username: "butter_bridge",
          password: "butter_bridge1"
        });

        const badCommentBody = {
          body: "This is a great comment!",
          username: tempAuth.body.user.username,
          fakeKey: "This should not work"
        };

        return request(app)
          .patch("/api/comments/1")
          .send(badCommentBody)
          .set("authorization", `Bearer ${tempAuth.body.user.token}`)
          .expect(400)
          .then(({ body }) => {
            expect(body.message).toBe("Invalid field body");
          });
      });
      it("returns a 403 when attempting to update a comment that does not belong to logged in user", () => {
        const badCommentBody = {
          body: "This is a great comment!",
          username: auth.username
        };

        return request(app)
          .patch("/api/comments/1")
          .send(badCommentBody)
          .set("authorization", `Bearer ${auth.token}`)
          .expect(403)
          .then((headers) => {
            expect(headers.text).toBe("Forbidden");
          });
      });
      it("returns a 401 when attempting to update a comment without a token", () => {
        const commentBody = {
          body: "This is a great comment!",
          username: "butter_bridge"
        };

        return request(app)
          .patch("/api/comments/1")
          .send(commentBody)
          .expect(401)
          .then((headers) => {
            expect(headers.text).toBe("Unauthorized");
          });
      });
      it("returns a 403 when attempting to update a comment with username that does not match token", () => {
        const commentBody = {
          body: "This is a great comment!",
          username: "some name"
        };

        return request(app)
          .patch("/api/comments/1")
          .send(commentBody)
          .set("authorization", `Bearer ${auth.token}`)
          .expect(403)
          .then((headers) => {
            expect(headers.text).toBe("Forbidden");
          });
      });
      it("returns a 404 when trying to update a comment that does not exist", () => {
        const commentBody = {
          body: "This is a great comment!",
          username: auth.username
        };
        return request(app)
          .patch("/api/comments/99999")
          .send(commentBody)
          .set("authorization", `Bearer ${auth.token}`)
          .expect(404)
          .then(({ body }) => {
            expect(body.message).toBe("Resource not found");
          });
      });
    });
  });
  describe("GET", () => {
    it("server responds with 200 response and the test comment", () => {
      return request(app)
        .get("/api/comments/1")
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual({
            comment: {
              comment_id: expect.any(Number),
              author: expect.any(String),
              article_id: expect.any(Number),
              votes: expect.any(Number),
              created_at: expect.any(String),
              body: expect.any(String)
            }
          });
        });
    });

    it("returns with 404 status and sends back message when trying to access an article that does not exist", () => {
      return request(app)
        .get("/api/comments/99999")
        .expect(404)
        .then(({ body }) => {
          expect(body.message).toBe("Resource not found");
        });
    });
    it("returns with 400 status and sends back message when trying to use invalid value for articleId parameter", () => {
      return request(app)
        .get("/api/comments/apple")
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Invalid input");
        });
    });
  });
});

describe("/api/users", () => {
  describe("GET", () => {
    it("returns a status of 200 and an array of user objects", () => {
      return request(app)
        .get("/api/users")
        .expect(200)
        .then(({ body }) => {
          expect(Array.isArray(body.users)).toBe(true);
          body.users.forEach((user) => {
            expect(user).toEqual(
              expect.objectContaining({
                username: expect.any(String)
              })
            );
          });
        });
    });
    it("returns a status of 404 when path is incorrect", () => {
      return request(app)
        .get("/api/user")
        .expect(404)
        .then(({ body }) => {
          expect(body.message).toBe("Path not found");
        });
    });
  });
  describe("POST", () => {
    it("returns a 201 status and the new user when posted to endpoints", () => {
      const newUser = {
        username: "testUser",
        name: "USER",
        avatar_url: "someAvatar",
        password: "password"
      };
      return request(app)
        .post("/api/users")
        .send(newUser)
        .expect(201)
        .then(({ body }) => {
          expect(body).toEqual({
            user: {
              username: "testUser",
              token: expect.any(String)
            }
          });
        });
    });
    it("returns a 400 status and an error message when posting with an invalid key", () => {
      const badUser = {
        username: "test",
        password: "password",
        name: "somename",
        namee: "badname",
        avatar_url: "avatar"
      };

      return request(app)
        .post("/api/users")
        .send(badUser)
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Invalid field body");
        });
    });
    it("returns a 409 status and an error message when posting a user that already exists", () => {
      const copyUser = {
        username: "icellusedkars",
        name: "badname",
        avatar_url: "avatar",
        password: "someStrongPassword"
      };

      return request(app)
        .post("/api/users")
        .send(copyUser)
        .expect(409)
        .then(({ body }) => {
          expect(body.message).toBe("User already exists");
        });
    });
    it("returns a 400 status and an error message when posting a user with null username", () => {
      const copyUser = {
        username: null,
        name: "badname",
        avatar_url: "avatar",
        password: "somePassword"
      };

      return request(app)
        .post("/api/users")
        .send(copyUser)
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Missing fields");
        });
    });
  });
});

describe("/api/users/:username", () => {
  describe("GET", () => {
    it("returns a status of 200 and the user object", () => {
      return request(app)
        .get("/api/users/rogersop")
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual({
            user: {
              username: "rogersop",
              avatar_url:
                "https://avatars2.githubusercontent.com/u/24394918?s=400&v=4",
              name: "paul"
            }
          });
        });
    });
    it("returns a status of 404 and an error message when attempting to retrieve a user that does not exist", () => {
      return request(app)
        .get("/api/users/MrBean")
        .expect(404)
        .then(({ body }) => {
          expect(body.message).toBe("Resource not found");
        });
    });
  });
  describe("PATCH", () => {
    it("returns an updated user with a status code of 200", async () => {
      const tempAuth = await request(app).post("/api/login").send({
        username: "rogersop",
        password: "rogersop1"
      });

      const userBody = {
        name: "aName",
        avatar_url: "anAvatar!",
        username: tempAuth.body.user.username
      };

      return request(app)
        .patch("/api/users/rogersop")
        .send(userBody)
        .set("authorization", `Bearer ${tempAuth.body.user.token}`)
        .expect(200)
        .then(({ body }) => {
          expect(body.user.name).toBe("aName");
          expect(body.user.avatar_url).toBe("anAvatar!");
          expect(body).toEqual({
            user: {
              username: "rogersop",
              name: "aName",
              avatar_url: "anAvatar!"
            }
          });
        });
    });

    it("returns an updated user with an updated name with status code of 200", async () => {
      const tempAuth = await request(app).post("/api/login").send({
        username: "rogersop",
        password: "rogersop1"
      });

      const userBody = {
        name: "aName",
        username: tempAuth.body.user.username
      };

      return request(app)
        .patch("/api/users/rogersop")
        .send(userBody)
        .set("authorization", `Bearer ${tempAuth.body.user.token}`)
        .expect(200)
        .then(({ body }) => {
          expect(body.user.name).toBe("aName");
          expect(body).toEqual({
            user: {
              username: "rogersop",
              name: "aName",
              avatar_url:
                "https://avatars2.githubusercontent.com/u/24394918?s=400&v=4"
            }
          });
        });
    });
    it("returns an updated user with an updated avatar_url with status code of 200", async () => {
      const tempAuth = await request(app).post("/api/login").send({
        username: "rogersop",
        password: "rogersop1"
      });

      const userBody = {
        avatar_url: "test",
        username: tempAuth.body.user.username
      };

      return request(app)
        .patch("/api/users/rogersop")
        .send(userBody)
        .set("authorization", `Bearer ${tempAuth.body.user.token}`)
        .expect(200)
        .then(({ body }) => {
          expect(body.user.name).toBe("paul");
          expect(body).toEqual({
            user: {
              username: "rogersop",
              name: "paul",
              avatar_url: "test"
            }
          });
        });
    });
    it("returns an unchanged user when receiving a blank body", async () => {
      const tempAuth = await request(app).post("/api/login").send({
        username: "rogersop",
        password: "rogersop1"
      });

      const userBody = {
        username: tempAuth.body.user.username
      };

      return request(app)
        .patch("/api/users/rogersop")
        .send(userBody)
        .set("authorization", `Bearer ${tempAuth.body.user.token}`)
        .expect(200)
        .then(({ body }) => {
          expect(body).toEqual({
            user: {
              username: "rogersop",
              name: "paul",
              avatar_url:
                "https://avatars2.githubusercontent.com/u/24394918?s=400&v=4"
            }
          });
        });
    });
    it("return a 404 when trying to update a user that does not exist", async () => {
      const tempAuth = await request(app).post("/api/login").send({
        username: "rogersop",
        password: "rogersop1"
      });

      const userBody = {
        username: tempAuth.body.user.username,
        avatar_url: "anAvatar!"
      };

      return request(app)
        .patch("/api/users/sonic")
        .send(userBody)
        .set("authorization", `Bearer ${tempAuth.body.user.token}`)
        .expect(404)
        .then(({ body }) => {
          expect(body.message).toBe("Resource not found");
        });
    });
    it("return a 400 when trying to update with an invalid key", async () => {
      const tempAuth = await request(app).post("/api/login").send({
        username: "rogersop",
        password: "rogersop1"
      });

      const userBody = {
        avatar_url: "anAvatar!",
        name: "sonic",
        username: tempAuth.body.user.username,
        badKey: "jaa"
      };
      return request(app)
        .patch("/api/users/rogersop")
        .send(userBody)
        .set("authorization", `Bearer ${tempAuth.body.user.token}`)
        .expect(400)
        .then(({ body }) => {
          expect(body.message).toBe("Invalid field body");
        });
    });
  });
});

describe("Util functions", () => {
  describe("checkExists", () => {
    it("returns an empty array for a valid value", () => {
      checkExists("articles", "article_id", 1).then((data) => {
        expect(data).toEqual([]);
      });
    });
  });
  describe("checkExistsPost", () => {
    it("returns an empty array for a valid value", () => {
      checkExistsPost("articles", "article_id", 1).then((data) => {
        expect(data).toBe("exists");
      });
    });
  });
  describe("generateAccessToken", () => {
    it("returns a token when supplied with a valid object", () => {
      const result = generateAccessToken({ test: "test" });
      expect(typeof result).toBe("string");
    });
    it("returns an error when supplied with an invalid value", () => {
      try {
        const result = generateAccessToken("er");
      } catch (err) {
        expect(typeof err).toBe("object");
      }
    });
  });
});
