import WebSocket, { WebSocketServer } from 'ws'
import express from 'express'
import { google } from 'googleapis'
import 'dotenv/config'
import { GoogleSpreadsheet } from 'google-spreadsheet'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const expressPort = 5601
const app = express()
app.use(express.json())

// Google Speadsheet API https://www.npmjs.com/package/google-spreadsheet
var creds = require('./gCredentials.json')

// To make sure all the events in a given litter box visit are in the queue together, we dont push data until
// there has not been a new event for this long. 
var catCooloff = 0 // Set to 30 seconds for prod
var lastCommunication = 0

const wsPort = 5600
const wss = new WebSocketServer({ port: wsPort })
const sheetID = process.env.CatSheet

const doc = new GoogleSpreadsheet(sheetID)

class Queue {
    constructor() {
        this.elements = {}
        this.head = 0
        this.tail = 0
    }
    enqueue(element) {
        this.elements[this.tail] = element
        this.tail++
    }
    dequeue() {
        const item = this.elements[this.head]
        delete this.elements[this.head]
        this.head++
        return item
    }
    peek() {
        return this.elements[this.head]
    }
    get length() {
        return this.tail - this.head
    }
    get isEmpty() {
        return this.length === 0
    }
}

var eventQueue = new Queue()

app.listen(expressPort, () => console.log('Express Server running on port ', expressPort))
var authenticated = false

const authentication = async () => {
    if (authenticated) return
    await doc.useServiceAccountAuth(creds)
    authenticated = true

    await doc.loadInfo()
    console.log("Authenticated for sheet:")
    console.log(doc.title)
}

function millis() {
    return new Date().getTime()
}

function timeStamp() {
    var today = new Date()
    var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate()
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds()
    var dateTime = date + ' ' + time
    return dateTime
}

// Create websocket server to listen for arduinos
wss.on('connection', function connection(ws) {
    console.log("Connection established with Arduino")
    ws.on('message', function message(data) {
        console.log('received: %s', data)
        var timestamp = timeStamp()
        console.log('Timestamp: ' + JSON.stringify(timestamp))

        if (authenticated) {
            pushUpdate(data, timestamp)
        }
        else {
            authentication()
            pushUpdate(data, timestamp)
        }
    })

})

function pushUpdate(data, timestamp) {
    // Add data to queue for pushing to database
    eventQueue.enqueue({ data: data, timestamp: timestamp })
    lastCommunication = millis()
}

wss.on('error', function errorHandle(err) {
    console.log('websocket error: %s', error)
})

// Express URL to force authentication
app.get('/sheet', async (req, res) => {
    // Request code
    try {
        await authentication()
        res.send(doc.title)
    } catch (e) {
        console.error(e)
        res.status(500).send()
    }
})

app.get('/sheetTest', async (req, res) => {
    try {
        await authentication()
        res.send(doc.title + " Connected to sheet, pushing test data ")
        rowPush({
            Cat: 'test Kitty',
            EventStart: timeStamp(),
            EventDuration: '42',
            Box: 'Z'
        })

    } catch (e) {
        console.error(e)
        res.status(500).send()
    }
})

app.get('/testEventWaffle', async (req, res) => {
    try {
        const timestamp = timeStamp()
        pushUpdate("ID:1TAG:871765540",timestamp)
        res.send("Waffle test event created with timestamp: " + timestamp)
    } catch (e) {
        console.error(e)
        res.status(500).send()
    }
})

app.get('/testEventPancake', async (req, res) => {
    try {
        const timestamp = timeStamp()
        pushUpdate("ID:2TAG:872285534",timestamp)
        res.send("Pancake test event created with timestamp: " + timestamp)

    } catch (e) {
        console.error(e)
        res.status(500).send()
    }
})

app.get('/testEventOther', async (req, res) => {
    try {
        const timestamp = timeStamp()
        pushUpdate("ID:2TAG:99999999",timestamp)
        res.send("Other test event created with timestamp: " + timestamp)

    } catch (e) {
        console.error(e)
        res.status(500).send()
    }
})

async function rowPush(data) {
    const sheet = doc.sheetsByIndex[0] // may need to change this to an ID if we have more than 1
    await sheet.addRow(data)
}

async function rowsPush(data) {
    const sheet = doc.sheetsByIndex[0]
    await sheet.addRows(data)
}

function processEventQueue() {
    // No processing if we dont have a connection to google sheets
    if (!authenticated) {
        console.log("not authenticated")
        return
    }
        
    // Dont process anything yet if the cat is still in the litter box!
    if (millis() - lastCommunication < catCooloff) {
        console.log("Cat still in box")
        console.log("Time since last event: ")
        console.log(millis() - lastCommunication)
        console.log("cooloff:")
        console.log(catCooloff)
        return    
    }  

    // Process into a map of cat+box to array
    // Note the first and last times in the array, use that to calculate duration. 
    // Push up one event for the duration of the stay 
    // No processing if there are no events    
    if (eventQueue.length > 0) {

        // Example scans:
        // Waffle: ID:2TAG:871765540
        // Pancake: ID:2TAG:872285534

        // Key: { cat, box } Value: { Array of Timestamps [] }
        var eventMap = new Map();
        eventMap.set("PancakeA", [])
        eventMap.set("PancakeB", [])
        eventMap.set("WaffleA", [])
        eventMap.set("WaffleB", [])
        eventMap.set("TestKittyA", [])
        eventMap.set("TestKittyB", [])

        console.log("Pushing up events, of which there are: ")
        console.log(eventQueue.length)

        // Todo:
        // [ ] Event duration 
        // [X] Litter box ID
        // [X] Group events together that are within a few seconds of each other
        // [ ] Any other processing/statistical analysis? (most of that can prob be better done in tableau)
        let len = eventQueue.length
        for (let i = 0; i < len; i++) {
            // Dequeue the event
            // Push it up to the server
            let event = eventQueue.dequeue()
            let cat = ""
            let box = event.data.substring(3,4) == '1' ? 'A' : 'B'

            if (event.data.substring(8) == "872285534") cat = "Pancake"
            else if (event.data.substring(8) == "871765540") cat = "Waffle"
            else cat = "TestKitty"
            
            console.log("Map before insertion:")
            printMap(eventMap)

            let key = cat + box
            console.log("cat: " + cat)
            console.log("box: " + box)
            console.log("key:" + key)
            console.log(event.data.substring(8))
            let getArray = eventMap.get(key)
            getArray.push(event.timestamp)
            eventMap.set(key,getArray)
            console.log("Map after insertion:")
            printMap(eventMap)
        }

        // Process cat arrays and push up the time differences


    }
    else {
        console.log("No cat updates to process :)")
    }
}

function printMap(map) {
    for (const [key, value] of map.entries())
    {
        console.log(key, value);
    }
}

setInterval(processEventQueue, 10000)
setInterval(authentication, 3000)