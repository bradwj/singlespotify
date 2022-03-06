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
        var answer = JSON.stringify(answers);
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
	let descendingOrder = flags["d"];

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
      let artistID = res.artists.items[0].id;
      spotifyApi.getArtistAlbums(artistID, token).then((res) => {
        for (let album of res.items) {
          allAlbums.push({ id: album.id, release_date: album.release_date });

          spotifyApi.getAlbumTracks(album.id, token).then((res) =>
            allTracks.push(
              ...res.items.map((track) => {
                return { uri: track.uri, release_date: album.release_date };
              })
            )
          );
        }
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
      // first create playlist with desired name
      spotifyApi.createPlaylist(playlistName, token).then((res) => {
				console.log(allTracks.length + " tracks");
				// sort tracks by ascending release date unless --descending [-d] flag is used
				if (descendingOrder) {
					allTracks = allTracks.sort(
            (a, b) => new Date(b.release_date) - new Date(a.release_date)
          );
				}
				else {
					allTracks = allTracks.sort(
						(a, b) => new Date(a.release_date) - new Date(b.release_date)
						);
				}
				console.log(allTracks);
				// we only need to pass in the track uris to the API
				allTracks = allTracks.map((track) => track.uri);

        // maximum of 100 tracks can be added per API request, so add 100 tracks at a time
        if (allTracks.length > 100) {
          let i = 0;
          while (i < allTracks.length) {
            console.log(allTracks.slice(i, i + 100).length + " tracks");
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
        } else {
          spotifyApi.populatePlaylist(res.id, allTracks, token)
            .then((res) => {
              console.log(res);
              spinner.succeed("Success!");
              console.log(
                chalk.green(`
      Your playlist is ready!
      It's called "${playlistName}"`)
              );
            })
            .catch((err) => {
              console.log(err.message);
            });
        }
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
      --name [-n] "playlist name"
			--descending [-d]

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
