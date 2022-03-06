var exports = (module.exports = {});
const axios = require("axios");

exports.searchArtists = function (artistName, token) {
  return axios({
    method: "GET",
    url: `https://api.spotify.com/v1/search`,
    params: {
      q: artistName,
      type: "artist"
    },
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  }).then((res) => res.data);
};

exports.getArtistAlbums = function (artistID, token) {
  return axios({
    method: "GET",
    url: `https://api.spotify.com/v1/artists/${artistID}/albums?include_groups=album,single`,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  }).then((res) => res.data);
};

exports.getAlbumTracks = function (albumID, token) {
  return axios({
    method: "GET",
    url: `https://api.spotify.com/v1/albums/${albumID}/tracks`,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  }).then((res) => res.data);
};

exports.createPlaylist = function (name, token) {
  return axios({
    method: "POST",
    url: `https://api.spotify.com/v1/me/playlists`,
    data: {
      name: name,
      description: "Playlist generated using singlespotify",
      public: true
    },
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  }).then((res) => res.data);
};

exports.populatePlaylist = function (id, tracks, token) {
  return axios({
    method: "POST",
    url: `https://api.spotify.com/v1/playlists/${id}/tracks`,
    data: {
      uris: tracks
    },
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  }).then((res) => res.data);
};
