/** @format */

const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nvffntx.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		await client.connect();

		const userCollection = client.db("summerCamp").collection("users");
		const classCollection = client.db("summerCamp").collection("classes");
		const instructorCollection = client
			.db("summerCamp")
			.collection("instructor");
		const classCartCollection = client
			.db("summerCamp")
			.collection("classCart");
		
		const paymentCartCollection = client
			.db("summerCamp")
			.collection("payment");

		// get user role
		app.get("/user-role", async (req, res) => {
			const email = req.query.email;
			const query = { email: email };

			const result = await userCollection.findOne(query);

			if (result?.role === "admin") {
				return res.send("admin");
			} else if (result?.role === "instractor") {
				return res.send("instractor");
			}

			res.send({});
		});

		// get all user
		app.get("/get-all-user", async (req, res) => {
			const result = await userCollection.find().toArray();
			res.send(result);
		});
		// store new user
		app.post("/users", async (req, res) => {
			const saveUser = req.body;
			const query = { email: saveUser.email };
			const existUser = await userCollection.findOne(query);
			if (existUser) {
				return res.send({});
			}
			const result = await userCollection.insertOne(saveUser);
			res.send(result);
		});

		// update user role
		app.put("/update-user-role", async (req, res) => {
			const user = req.body;

			const filter = { email: user?.email };
			const options = { upsert: true };
			const updateDoc = {
				$set: {
					role: user?.role,
				},
			};

			const result = await userCollection.updateOne(
				filter,
				updateDoc,
				options
			);

			res.send(result);
		});

		// get classes for user
		app.get("/approverd-classes", async (req, res) => {
			const numberOfData = req?.query?.numberOfData;
			const sortValue = req?.query?.sort;
			const query = { status: { $eq: "approved" } };
			if (numberOfData !== "undefined" && sortValue !== "undefined") {
				
				const resutl = await classCollection
					.find(query)
					.limit(parseInt(numberOfData))
					.sort({ totalStudent: sortValue })
					.toArray();
				return res.send(resutl);
			}
			
			const resutl = await classCollection.find(query).toArray();
			
			res.send(resutl);
		});

		// getclass for admin
		app.get("/classes", async (req, res) => {
			const result = await classCollection.find().toArray();
			res.send(result);
		});

		// get Class for instructor
		app.get("/instructor-classes", async (req, res) => {
			const email = req.query.email;
			const query = { instructorEmail: email };
			const cursor = await classCollection.find(query).toArray();
			res.send(cursor);
		});

		// add new class by instractor
		app.post("/add-an-class", async (req, res) => {
			const classInfo = req.body;
			const result = await classCollection.insertOne(classInfo);
			res.send(result);
		});

		// update Class status by admibn
		app.put("/update-class-status", async (req, res) => {
			const body = req.body;
			const id = req?.body?.id;
			const feedBack = req?.body?.feedBack;
			const statusValue = req?.body?.status;
			let updateValue = { status: statusValue };
			if (feedBack) {
				updateValue.feedBack = feedBack;
			}
			const filter = { _id: new ObjectId(id) };
			const options = { upsert: true };
			const updateDoc = {
				$set: updateValue,
			};
			const result = await classCollection.updateOne(
				filter,
				updateDoc,
				options
			);

			res.send({});
		});

		//  add to cart class for user
		app.post("/class-add-to-cart", async (req, res) => {
			const cartClass = req.body;
			const studentEmail = req.body.studentEmail;
			const classId = req.body.classId;
			const query = { classId, studentEmail };

			const isExist = await classCartCollection.findOne(query);

			if (isExist) {
				return res.send({ message: "already added" });
			}

			const result = await classCartCollection.insertOne(cartClass);

			res.send(result);
		});

		// get all cart class by login user
		app.get("/cart-classes", async (req, res) => {
			const email = req.query.email;
			const query = { studentEmail: email };
			const result = await classCartCollection.find(query).toArray();
			res.send(result);
		});

		// delete class form cart for student 
		app.delete("/delete-cart-class/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await classCartCollection.deleteOne(query);
			res.send(result);
		});

		// get instructor
		app.get("/instructor", async (req, res) => {
			const numberOfData = req?.query?.numberOfData;
			const sortValue = req?.query?.sort;

			if (numberOfData !== "undefined" && sortValue !== "undefined") {
				const resutl = await instructorCollection
					.find()
					.limit(parseInt(numberOfData))
					.sort({ experience: sortValue })
					.toArray();
				return res.send(resutl);
			}

			const result = await instructorCollection.find().toArray();
			res.send(result);
		});


		// create payment intent
		app.post("/create-payment-intent",  async (req, res) => {
			const { price } = req.body;
			
			const amount = parseInt(price * 100);
			const paymentIntent = await stripe.paymentIntents.create({
				amount: amount,
				currency: "usd",
				payment_method_types: ["card"],
			});

			res.send({
				clientSecret: paymentIntent.client_secret,
			});
		});


		app.post('/payments', async (req, res) => {
			const payment = req.body;

			
			const result = await paymentCartCollection.insertOne(payment);
			const query = {
				_id: { $in: payment.cartClassesId.map(id => new ObjectId(id)) },
			};
			const deleteResult = await classCartCollection.deleteMany(query);

			const filter = {
				_id: { $in: payment.classId.map(id => new ObjectId(id)) },
			};

			const getData = await classCollection.find(filter).toArray();

			for (const update of getData) {
				const { totalStudent, _id, availableSeats } = update;

				 await classCollection.updateOne(
						{ _id:  _id },
						{
							$set: {
								totalStudent: totalStudent + 1,
								availableSeats: availableSeats -1,
							},
						}
					);
			}

			res.send(result)
		})

		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);


app.get("/", (req, res) => {
	res.send("Bristo Server running...");
});


app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
