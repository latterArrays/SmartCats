/*
  Websocket client for SmartCats project
  Scans for 134 KHz Pet RFID Tags and reports sitings to a websocket server
  See 'arduino_secrets.h.example' for needed secrets (remove the .example in actual usage)
*/
#include <ArduinoHttpClient.h>
#include <WiFi101.h>    // use this for MKR1000
#include "arduino_secrets.h" 
#include <Rfid134.h>


#define RST_PIN 7
#define BLINK 6

// Websocket connection info
int port = 5600;
WiFiClient wifi;
WebSocketClient client = WebSocketClient(wifi, serverAddress, port);
int status = WL_IDLE_STATUS;
int count = 0;
int wifi_timeout_ms = 5000;
int ws_message_size = 0;
int last_server_ping = 0;

// Variables for RFID sensor reading (WL-134)


int this_sensor = 2;

// Helper functions for operating the LED
void slow_blink() {
    for(int i = 0; i < 3; i++) {
    digitalWrite(BLINK, HIGH);
    delay(250);
    digitalWrite(BLINK, LOW);
    delay(250);
  }
}

void fast_blink() {
  for(int i = 0; i < 20; i++) {
    digitalWrite(BLINK, HIGH);
    delay(50);
    digitalWrite(BLINK, LOW);
    delay(50);

  }
}

void reset_rfid_scanner() {
  digitalWrite(RST_PIN, LOW);
  delay(200);
  digitalWrite(RST_PIN, HIGH);

}

// Append ID of arduino
// Turn LED on when socket is connected
// Turn off when socket loop breaks
void transmit_message(int message) {
  client.beginMessage(TYPE_TEXT);
  client.print("ID:");
  client.print(this_sensor);
  client.print("TAG:");
  client.print(message);
  client.endMessage();
}

Rfid134<HardwareSerial, RfidNotify> rfid(Serial1);

void setup() {
  
  // Serial connection to computer for debug
  Serial.begin(9600);

  // Set up pinouts and do an initial blink to verify setup
  pinMode(RST_PIN, OUTPUT);
  pinMode(BLINK, OUTPUT);
  fast_blink();
  
  // Reset the RFID Scanner
  reset_rfid_scanner();
  
  // Connect to WIFI
  while ( status != WL_CONNECTED) {

    // Connect to WPA/WPA2 network:
    status = WiFi.begin(SECRET_SSID, SECRET_PASS);
  }

  int last_server_ping = millis();

  Serial1.begin(9600, SERIAL_8N2);

  rfid.begin();

    Serial.println("Start");
}

void loop() {

  // Start Websocket client
  client.begin();
  slow_blink();
  // Get client connection (no point processing any further otherwise)
  while (client.connected()) {
    digitalWrite(BLINK, HIGH);

    rfid.loop();
  } 

  //TODO: use last server ping to put a WiFi timout 

   digitalWrite(BLINK, LOW);

  // Wait a while and try the connection again
  delay(wifi_timeout_ms);
  Serial.println("Awaiting websocket connection");
}