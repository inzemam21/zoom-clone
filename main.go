package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // Allow all origins for testing
}
var clients = make(map[*websocket.Conn]bool)
var mutex = sync.Mutex{}

type Signal struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

func signalingHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer conn.Close()

	mutex.Lock()
	clients[conn] = true
	mutex.Unlock()
	defer func() {
		mutex.Lock()
		delete(clients, conn)
		mutex.Unlock()
	}()

	log.Printf("Client connected. Total clients: %d", len(clients))

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Println("Read error:", err)
			return
		}

		var signal Signal
		if err := json.Unmarshal(msg, &signal); err != nil {
			log.Println("Unmarshal error:", err)
			continue
		}

		mutex.Lock()
		for client := range clients {
			if client != conn {
				err = client.WriteMessage(websocket.TextMessage, msg)
				if err != nil {
					log.Println("Write error:", err)
				}
			}
		}
		mutex.Unlock()
		log.Printf("Broadcasted: %s", msg)
	}
}

func main() {
	http.Handle("/", http.FileServer(http.Dir("static")))
	http.HandleFunc("/ws", signalingHandler)
	log.Println("Server running on :8080 (HTTPS)")
	log.Fatal(http.ListenAndServeTLS(":8080", "cert.pem", "key.pem", nil))
}
