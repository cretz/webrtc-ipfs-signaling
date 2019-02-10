package main

import (
	"log"
	"net/http"
)

func main() {
	fs := http.FileServer(http.Dir("."))
	err := http.ListenAndServe(":8080", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Access-Control-Allow-Origin", "*")
		fs.ServeHTTP(w, r)
	}))
	log.Fatal(err)
}
