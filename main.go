package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Client struct {
	conn *websocket.Conn
	room string
	id   string // Will use 'from' from frontend
}

var clients = make(map[string]*Client) // Key by client ID (from frontend)
var mutex = sync.Mutex{}

type Signal struct {
	Type string `json:"type"`
	Data string `json:"data"`
	Room string `json:"room"`
	From string `json:"from"`
	To   string `json:"to"`
}

func signalingHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer conn.Close()

	room := r.URL.Query().Get("room")
	if room == "" {
		log.Println("No room specified")
		return
	}

	// Client ID set later via first message
	client := &Client{conn: conn, room: room}
	var clientId string

	defer func() {
		if clientId != "" {
			mutex.Lock()
			delete(clients, clientId)
			mutex.Unlock()
			log.Printf("Client %s disconnected from room %s. Total clients: %d", clientId, room, len(clients))
		}
	}()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Println("Read error for", clientId, ":", err)
			return
		}

		var signal Signal
		if err := json.Unmarshal(msg, &signal); err != nil {
			log.Println("Unmarshal error:", err)
			continue
		}

		// Set client ID on first message
		if clientId == "" {
			clientId = signal.From
			client.id = clientId
			mutex.Lock()
			clients[clientId] = client
			mutex.Unlock()
			log.Printf("Client %s connected to room %s. Total clients: %d", clientId, room, len(clients))
		}

		log.Printf("Received from %s in room %s: %s", clientId, room, string(msg))

		mutex.Lock()
		for id, c := range clients {
			if c.room == room && id != clientId {
				// Send to all if 'to' is empty, or to specific client if 'to' matches
				if signal.To == "" || signal.To == id {
					err = c.conn.WriteMessage(websocket.TextMessage, msg)
					if err != nil {
						log.Println("Write error to", id, ":", err)
					} else {
						log.Printf("Sent to %s in room %s: %s", id, room, string(msg))
					}
				}
			}
		}
		mutex.Unlock()
	}
}

func main() {
	http.Handle("/", http.FileServer(http.Dir("static")))
	http.HandleFunc("/ws", signalingHandler)
	log.Println("Server running on :8080 (HTTPS)")
	log.Fatal(http.ListenAndServeTLS(":8080", "cert.pem", "key.pem", nil))
}
