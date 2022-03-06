#!/usr/bin/env node
"use strict";
const meow = require("meow");
const chalk = require("chalk");
const ora = require("ora");
const inquirer = require("inquirer");
const Conf = require("conf");
const updateNotifier = require("update-notifier");
const pkg = require("./package.json");
const spinner = ora("Loading ...");

// config file stored in /Users/{home}/Library/Preferences/{project-name}
const config = new Conf();
const spotifyApi = require("./api_calls/requests");

function auth() {
  return new Promise((resolve, reject) => {
    inquirer
      .prompt([
        {
          type: "input",
          message: "Enter your Spotify username",
          name: "username"
        },
        {
          type: "password",
          message: "Enter your Spotify bearer token",
          name: "bearer"
        }
      ])
      .then(function (answers) {
        const answer = JSON.stringify(answers);
        config.set(answers);
        resolve(true);
      })
      .catch((err) => reject(err));
  });
}

const singlespotify = async function singlespotify(inputs, flags) {
  // "Young Thug"
  const artistName = inputs;
  // name of the playlist, optional parameter
  let playlistName = flags["n"];

  if (playlistName === undefined || playlistName === true) {
    playlistName = `${artistName}: singlespotify`;
  }

  if (artistName === undefined) {
    spinner.fail("Failed");
    console.log(
      chalk.red(`
  Oops! Remember to add an artist name!

  Example
    singlespotify "Michael Jackson"
    `)
    );
    return;
  }

  // empty string
  if (artistName.trim() === "") {
    spinner.fail("Failed");
    config.clear();
    console.log(
      chalk.red(`
  Oops! Artist name can't be empty. Please provide an artist name!
    `)
    );
    return;
  }

  // ora loading spinner
  spinner.start();

  var allAlbums = [];
  var allTracks = [];

  // get artist URI
  let token = config.get("bearer");
  // const artistSearch = await
  spotifyApi
    .searchArtists(artistName, token)
    .then((res) => {
      if (res.artists.items[0] === undefined) {
        spinner.fail("Failed");
        config.clear();
        console.log(
          chalk.red(`
  
    Oops! That search didn't work. Try again please!
      `)
        );
        process.exit();
      }
      // TODO: be able to deselect albums that we dont want added to the playlist
      let artistID = res.artists.items[0].id;
      spotifyApi.getArtistAlbums(artistID, token).then(async (res) => {
        for (let album of res.items) {
          allAlbums.push(album);
        }
        // create inquire check box with each album name 
        spinner.stop(); // stop spinner for checkbox prompt
        // TODO: show type of album next to each album choice
        inquirer
          .prompt([
            {
              type: "checkbox",
              message:
                "Deselect any albums you wish to not be added to the playlist",
              name: "albums",
              checked: true,
              choices: [
                ...allAlbums.map(album => {
                  return {
                    name: `[${album.album_type}] ${album.name} `,
                    value: album,
                    checked: true
                  };
                })
              ]
            }
          ])
          .then(function (selectedAlbums) {
            // add all the tracks from each selected playlist to allTracks list
            for (let album of selectedAlbums.albums) {
              spotifyApi.getAlbumTracks(album.id, token).then(res =>
                allTracks.push(
                  ...res.items.map((track) => {
                    return { uri: track.uri, release_date: album.release_date };
                  })
                )
              );
            }
            spinner.start(); //resume spinner
          })
          .catch((err) => console.log(err));
      });
    })
    .catch(async (err) => {
      spinner.fail("Failed");
      config.clear();
      console.log(
        chalk.red(`
ERROR: Incorrect username or bearer token

You might need to update your bearer token

Generate a new one at https://developer.spotify.com/console/post-playlists/

Try again!
$ singlespotify "artist_name"`)
      );
      process.exit();
    });
  var timeout = setInterval(function () {
    if (allTracks.length !== 0) {
      clearInterval(timeout);
      // create playlist with desired name
      spotifyApi.createPlaylist(playlistName, token).then((res) => {

        // sort tracks by ascending release date unless --descending [-d] flag is used
        if (flags["d"]) {
          allTracks = allTracks.sort(
            (a, b) => new Date(b.release_date) - new Date(a.release_date)
          );
        }
        else {
          allTracks = allTracks.sort(
            (a, b) => new Date(a.release_date) - new Date(b.release_date)
            );
        }
        // only need to pass in the track uris to the API
        allTracks = allTracks.map((track) => track.uri);

        // maximum of 100 tracks can be added per API request, so add 100 tracks at a time
        let i = 0;
        while (i < allTracks.length) {
          spotifyApi.populatePlaylist(
            res.id,
            allTracks.slice(i, i + 100),
            token
          );
          i += 100;
        }
        spinner.succeed("Success!");
        console.log(
          chalk.green(`
    Your playlist is ready!
    It's called "${playlistName}"`)
        );
      });
    }
  }, 400);
};

spinner.stop(); // like return

const cli = meow(
  chalk.cyan(`
    Usage
      $ singlespotify "artist_name"
      ? Enter your Spotify username <username>
      ? Enter your Spotify bearer token <bearer>

    Options
      --name [-n] "playlist name"    Name of the playlist
      --descending [-d]              Sort the tracks in descending order by release date

    Example
      $ singlespotify -a "Michael Jackson" -n "MJ's Tracks"
      ? Enter your Spotify username bradwj
      ? Enter your Spotify bearer token ************************************************************

    For more information visit https://github.com/bradwj/singlespotify

`),
  {
    alias: {
      n: "name"
    },
    alias: {
      d: "descending"
    }
  }
);

updateNotifier({ pkg }).notify();

(async () => {
  if (
    config.get("username") === undefined ||
    config.get("bearer") === undefined
  ) {
    let authorization = await auth();
  }
  singlespotify(cli.input[0], cli.flags);
})();
