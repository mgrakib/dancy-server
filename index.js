/** @format */

const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


// TODO: make change instractor to instructor

const verifyJWT = (req, res, next) => {
	const authorization = req.headers.authorization;
	if (!authorization) {
		
		return res
			.status(401)
			.send({ error: true, message: " Unauthorized Access"});
	}

	const token = authorization.split(' ')[1];

	jwt.verify(token, process.env.JWT_ACCESS_TOKEN, (error, decoded) => {
		if (error) {
			
			return res.status(401).send({error:true, message:'Unauthorized Access'})
		}
		req.decoded = decoded;
		next();
	});
	
}


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

		const paymentCollection = client.db("summerCamp").collection("payment");
		const enrolledClassesCollection = client
			.db("summerCamp")
			.collection("enrolledClasses");

		//*******/ VERIFY ADMIN ********
		const verifyAdmin = async(req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await userCollection.findOne(query);
			if (user?.role !== 'admin') {
				return res.status(403).send({error:true, message:'Forbidden Access'})
			}
			next()
		}

		//********* VERIFY INSTRUCTOR *********
		const verifyInstructor = async (req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await userCollection.findOne(query);
			if (user?.role !== "instractor") {
				return res
					.status(403)
					.send({ error: true, message: "Forbidden Access" });
			}
			next();
		}




		// ********** COMMON API *************

		// JWT Access Token Genterate
		app.post("/jwt", async (req, res) => {
			const body = req.body;
			const token = jwt.sign(body, process.env.JWT_ACCESS_TOKEN, {
				expiresIn: "1h",
			});
			res.send({ token });
		});

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

		// store new user when user create accoutn
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

		// get classes for user just approved
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

		// get instructor
		app.get("/instructor", async (req, res) => {
			const numberOfData = req?.query?.numberOfData;
			const sortValue = req?.query?.sort;

			if (numberOfData !== "undefined" && sortValue !== "undefined") {
				const resutl = await instructorCollection
					.find()
					.limit(parseInt(numberOfData))
					.sort({ totalEnrolledStudent: sortValue })
					.toArray();
				return res.send(resutl);
			}

			const result = await instructorCollection.find().toArray();
			res.send(result);
		});

		// create payment intent
		app.post("/create-payment-intent", async (req, res) => {
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

		// ********** ADMIN API *************
		// get all user for admin
		app.get("/get-all-user", verifyJWT, verifyAdmin, async (req, res) => {
			const result = await userCollection.find().toArray();
			res.send(result);
		});

		// update user role
		app.put(
			"/update-user-role",
			verifyJWT,
			verifyAdmin,
			async (req, res) => {
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
			}
		);

		// make user to instracto FRO AMDIN
		app.post(
			"/make-instructor/:email",
			verifyJWT,
			verifyAdmin,
			async (req, res) => {
				const userEmail = req.params.email;
				const query = { email: userEmail };
				const user = await userCollection.findOne(query);
				const { _id, email, userImg, name } = user;
				const instructorInfo = {
					userId: _id,
					email,
					userImg,
					joiningDate: new Date(),
					name,
				};
				const result = await instructorCollection.insertOne(
					instructorInfo
				);
				res.send(result);
			}
		);

		// get all classes approved or not class for admin
		app.get("/classes", verifyJWT, verifyAdmin, async (req, res) => {
			const result = await classCollection.find().toArray();
			res.send(result);
		});

		// update Class status by admibn
		app.put(
			"/update-class-status",
			verifyJWT,
			verifyAdmin,
			async (req, res) => {
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
			}
		);

		// update instractor info
		app.put("/update-instructor-info", async (req, res) => {
			const body = req.body;
			const instractorEmail = body?.email;
			const className = body?.name;
			const filter = { email: instractorEmail };
			const options = { upsert: true };
			const instractor = await instructorCollection.findOne({
				email: instractorEmail,
			});
			const previousClasss = instractor?.className;

			let updateDoc;
			if (previousClasss) {
				updateDoc = {
					$set: {
						className: [className, ...previousClasss],
					},
				};
			} else {
				updateDoc = {
					$set: {
						className: [className],
					},
				};
			}

			const result = await instructorCollection.updateOne(
				filter,
				updateDoc,
				options
			);

			res.send(result);
		});


		// ********** INSTRUCTORS API *************
		// get all  Class for instructor dashboard
		app.get("/instructor-classes", verifyJWT, verifyInstructor, async (req, res) => {
			const email = req.query.email;

			// check for forbidden access
			const decodedEmail = req?.decoded?.email;
			if (email !== decodedEmail) {
				return res
					.status(403)
					.send({ error: true, message: "Forbidden Access" });
			}

			const query = { instructorEmail: email };
			const cursor = await classCollection.find(query).toArray();
			res.send(cursor);
		});

		// add new class by instractor
		app.post("/add-an-class", verifyJWT, verifyInstructor, async (req, res) => {
			const classInfo = req.body;
			const result = await classCollection.insertOne(classInfo);
			res.send(result);
		});

		// ********** STUDENTS API *************
		// get instractor class for users
		app.get("/get-instructor-classes/:email", async (req, res) => {
			const email = req.params.email;
			const query = { instructorEmail: email, status: "approved" };
			const result = await classCollection.find(query).toArray();
			res.send(result);
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
		app.get("/cart-classes", verifyJWT, async (req, res) => {
			const email = req.query.email;

			// check for forbidden access
			const decodedEmail = req?.decoded?.email;
			if (email !== decodedEmail) {
				return res
					.status(403)
					.send({ error: true, message: "Forbidden Access" });
			}
			const query = { studentEmail: email };
			const result = await classCartCollection.find(query).toArray();
			res.send(result);
		});

		// get student enrollment classes
		app.get("/enrolled-classes", verifyJWT, async (req, res) => {
			const studentEmail = req.query;

			// check for forbidden access
			const decodedEmail = req?.decoded?.email;
			if (studentEmail.email !== decodedEmail) {
				return res
					.status(403)
					.send({ error: true, message: "Forbidden Access" });
			}

			const query = { studentEmail: studentEmail.email };
			const enrolledResult = await enrolledClassesCollection
				.find(query)
				.toArray();
			res.send(enrolledResult);
		});

		// delete class form cart for student
		app.delete("/delete-cart-class/:id", verifyJWT, async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await classCartCollection.deleteOne(query);
			res.send(result);
		});

		// payment with update instractor , update student
		app.post("/payments", verifyJWT, async (req, res) => {
			// payment data set to DB
			const payment = req.body;
			const paymentResult = await paymentCollection.insertOne(payment);

			// DELETE from class cart collection
			const query = { _id: new ObjectId(payment.cartClassesId) };
			const deleteResult = await classCartCollection.deleteMany(query);

			// update to class collections available sets and totalStudent
			const filterForCLasses = {
				_id: new ObjectId(payment.classId),
			};
			const getClassesData = await classCollection.findOne(
				filterForCLasses
			);
			const {
				totalStudent,
				_id: classId,
				availableSeats,
			} = getClassesData;

			const updateResultClasses = await classCollection.updateOne(
				{ _id: classId },
				{
					$set: {
						totalStudent: totalStudent + 1,
						availableSeats: availableSeats - 1,
					},
				}
			);

			// update instractor to totalEnrolled student
			const filterForInstractor = {
				email: payment.instructorEmail,
			};
			const getInstractorData = await instructorCollection.findOne(
				filterForInstractor
			);
			const { _id: instructorId, totalEnrolledStudent } =
				getInstractorData;

			const updateResultInstractor = await instructorCollection.updateOne(
				{ _id: instructorId },
				{
					$set: {
						totalEnrolledStudent: totalEnrolledStudent
							? totalEnrolledStudent + 1
							: 1,
					},
				}
			);

			const updatedClassFilter = {
				_id: new ObjectId(payment.classId),
			};
			const updateClass = await classCollection.findOne(
				updatedClassFilter
			);

			// set enrollment collection
			const {
				classId: _id,
				name,
				instructorEmail,
				instructorName,
				totalStudent: updatedTotalStudent,
				price,
				img,
			} = updateClass;

			const enrolledClassInfo = {
				studentEmail: payment.email,
				classId,
				name,
				instructorEmail,
				instructorName,
				totalStudent: updatedTotalStudent,
				price,
				img,
			};

			const enrolledClasssResult =
				await enrolledClassesCollection.insertOne(enrolledClassInfo);

			res.send({
				updateResultClasses,
				updateResultInstractor,
				enrolledClasssResult,
			});
		});

		// user payment history
		app.get("/payment-history", verifyJWT, async (req, res) => {
			const studentEmail = req.query.email;

			// check for forbidden access
			const decodedEmail = req?.decoded?.email;
			if (studentEmail !== decodedEmail) {
				return res
					.status(403)
					.send({ error: true, message: "Forbidden Access" });
			}

			const query = { email: studentEmail };
			const paymentResult = await paymentCollection
				.find(query)
				.sort({ date: -1 })
				.toArray();
			res.send(paymentResult);
		});

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
