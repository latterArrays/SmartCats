# SmartCats
Code for the Smart Cat Litter Box project. 
This project is an effort to automate data collection about my cats' litter box habits, in order to monitor for signs of sickness.
Our cat Pancake has a history of urinary issues, so this project is an attempt to track trends of his litter box visits. 

# Arduino Sketch
This sketch is written to run on a mkr1000 Arduino board, and makes use of the built in wifi to communite with the node server via websockets. 
The board is connected to the WL-134 RFID sensor via a serial UART connection. 

A great resource on this board's usage for a similar use case can be found here:
https://www.youtube.com/watch?v=y89yJ1Fq-hQ

The library for using the WL-134 can be found here:
https://www.arduino.cc/reference/en/libraries/rfid134-by-makuna/

The exact product comes from many different vendors, but at the time of this writing, here is were you can find one:
https://tinyurl.com/43kf5x8x

To run, simply compile this code in the Arduino IDE an deploy to your board of choice. 
The Serial configurations for boards differ, so you will need to adapt form the mkr1000 to your board of choice. 

# Node Server
The node project runs a websocket server that listens for the arduino to communicate. 
When the arduino board pushes up an event, the node server begins to collect adjacent events, and will process them after a cooldown.
This allows time for the cat to leave the litter box before time durations are calculated. 

There is also an express server running, to allow GET requests to trigger certain test events. 

# Google Sheets API
To get the data somewhere usable, I am using the Google Sheets API. There are example files in the project that you can get form your google devloper dashboard 
to set up a similiar environment. There are a few libraries out there for interacting with google sheets via a node project, and the library I used/guide I followed is here:
https://www.npmjs.com/package/google-spreadsheet


# Tableau Public
Tableau is a data analytics tool for many myriad purposes. I am using it in this project to display the data on a dashboard, and will be using it for more statistical analysis down the road. You can view the public data vizualization associated with the project here:
https://public.tableau.com/views/CatTracker/Events?:language=en-US&:display_count=n&:origin=viz_share_link
