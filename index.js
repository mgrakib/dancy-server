/** @format */

const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
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

		// get user role 
		app.get('/user-role', async (req, res) => {
			const email = req.query.email;
			const query = { email: email };

			const result = await userCollection.findOne(query);
			
			if (result?.role === "admin") {
				return res.send("admin");
			} else if (result?.role === "instractor") {
				return res.send("instractor");
			}
			
			res.send({})
		})
		
		
        // user sing in
		app.get('/get-all-user', async (req, res) => {
			const result = await userCollection.find().toArray();
			res.send(result)
		})
        // store new user 
		app.post('/users', async (req, res) => {
            const saveUser = req.body;
			const query = { email: saveUser.email };
			const existUser = await userCollection.findOne(query);
			if (existUser) {
				return res.send({});
			}
			const result = await userCollection.insertOne(saveUser);
			res.send(result);
        })


		// update user role 
		app.put('/update-user-role', async (req, res) => {
			const user = req.body;
			
			const filter = { email: user?.email };
			const options = { upsert: true };
			const updateDoc = {
				$set: {
					role: user?.role
				}
			}

			const result = await userCollection.updateOne(filter, updateDoc, options);

			res.send(result);
		})



		// getclass 
		app.get('/classes', async (req, res) => {
			const result = await classCollection.find().toArray();
			res.send(result)
		})

		// update Class status 
		app.put('/update-class-status', async (req, res) => {
			const body = req.body;
			const id = req?.body?.id;
			const feedBack = req?.body?.feedBack;
			const statusValue = req?.body?.status;
			let updateValue = {status:  statusValue};
			if (feedBack) {
				updateValue.feedBack = feedBack;
			}
			const filter = { _id: new ObjectId(id) }
			 const options = { upsert: true };
			const updateDoc = {
				$set: updateValue,
			};
			const result = await classCollection.updateOne(filter, updateDoc, options);

			res.send({});
		} )


		// getinstructor
		app.get("/instructor", async (req, res) => {
			const result = await instructorCollection.find().toArray();
			res.send(result)
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
