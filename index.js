const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const app = express()
const port = process.env.PORT || 5500;
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()

app.use(cors())
app.use(express.json())

app.get('/', async (req, res) => {
    res.send('hello world')
})
const uri = process.env.DB_URL;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//JWT Midaleware

const JWTFunction = (req, res, next) => {
    const message = 'user unauthorized'
    const authorizationHeaders = req.headers.authorization
    // console.log(authorizationHeaders);
    if (!authorizationHeaders) {
        return res.status(401).send({ message })
    }
    const token = authorizationHeaders.split(' ')[1]
    jwt.verify(token, process.env.JWT, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message })
        }
        req.decoded = decoded
    })
    next()
}

async function run() {
    try {
        const DoctorData = client.db('Doctor-Server').collection('appointmentoption');
        const bookingsCollection = client.db('Doctor-Server').collection('bookings')
        const usersCollection = client.db('Doctor-Server').collection('users')
        const doctorCollection = client.db('Doctor-Server').collection('Doctors')

        app.put('/addPrice', async (req, res) => {
            const filter = {}
            const option = { upsert: true }
            const docs = {
                $set: {
                    price: 99
                }
            }
            const result = await DoctorData.updateMany(filter, docs, option)
            console.log(result);
            res.send(result)
        })


        const verifyAdmin = async (req, res, next) => {
            const decoded = req.decoded.email;
            // console.log(decoded);
            const query = {
                email: decoded
            }
            const userAdmin = await usersCollection.findOne(query)
            if (userAdmin?.role !== 'Admin') {
                return res.status(403).send({ message: 'You cannot make a admin' })
            }
            next()
        }



        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        app.get('/oneuser', JWTFunction, async (req, res) => {
            const email = req.query.email;
            const query = {
                email,
            }
            const result = await usersCollection.findOne(query)
            if (result) {
                res.send({ isAdmin: result?.role === 'Admin' })
            }
        })

        app.get('/allusers', JWTFunction, verifyAdmin, async (req, res) => {
            const query = {}
            const result = await usersCollection.find(query).toArray()
            res.send(result);
        })

        app.put('/adminuser/:id', JWTFunction, verifyAdmin, async (req, res) => {
            const id = req.params.id
            // const decoded = req.decoded.email;
            // const query = {
            //     email: decoded
            // }
            // const userAdmin = await usersCollection.findOne(query)
            // if (userAdmin?.role !== 'Admin') {
            //     return res.status(403).send({ message: 'You cannot make a admin' })
            // }
            const filter = { _id: ObjectId(id) }
            const option = { upsert: true };
            const docs = {
                $set: {
                    role: 'Admin'
                }
            }
            const result = await usersCollection.updateOne(filter, docs, option)
            res.send(result);
        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email
            const query = {
                email,
            }
            const user = await usersCollection.findOne(query)
            if (user) {
                const token = jwt.sign({ email }, process.env.JWT, { expiresIn: '10h' })
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })
        })

        app.get('/appointment/option', JWTFunction, async (req, res) => {
            const query = {}
            const date = req.query.date;
            const bookingQuery = { date }
            const options = await DoctorData.find(query).toArray();
            const AlreadyBooked = await bookingsCollection.find(bookingQuery).toArray();

            options.map(option => {
                const optionBooked = AlreadyBooked.filter(book => book.treatment === option.name);
                const bookingSlots = optionBooked.map(book => book.slot)
                const freeSlots = option.slots.filter(slot => !bookingSlots.includes(slot))
                option.slots = freeSlots;
            })
            res.send(options)
        })

        app.get('/bookings', JWTFunction, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded?.email;
            // console.log(email, decodedEmail);
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'user unauthorized' })
            }
            const query = {
                email,
            }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result);
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = {
                date: booking.date,
                treatment: booking.treatment,
                email: booking.email,
            }
            const alreadybooking = await bookingsCollection.find(query).toArray()
            if (alreadybooking.length) {
                const message = `you have an already added ${booking.date}`
                return res.send({ acknowledge: false, message })
            }
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        })

        app.delete('/userdeleted/:id', JWTFunction, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result)
        })
        app.get('/appointment/specialty', JWTFunction, async (req, res) => {
            const query = {};
            const result = await DoctorData.find(query).project({ name: 1 }).toArray()
            res.send(result)
        })

        app.post('/dashboard/doctorlist', JWTFunction, async (req, res) => {
            const data = req.body;
            // console.log(data);
            const result = await doctorCollection.insertOne(data)
            res.send(result)
        })
        app.get('/dashboard/doctorlist', JWTFunction, async (req, res) => {
            const query = {}
            const result = await doctorCollection.find(query).toArray()
            res.send(result)
        })
        app.delete('/dashboard/doctorlist/:id', JWTFunction, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await doctorCollection.deleteOne(query)
            res.send(result)
        })

    }
    finally {

    }
}
run().catch(() => { })



app.listen(port, () => {
    console.log('server is running no ', port);
})