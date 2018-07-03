var gulp = require('gulp');
var runSequence = require('run-sequence');
var packageJson = require('../package.json');
var prompt = require('gulp-prompt');
var gulpGit = require('gulp-git');
var gulpBump = require('gulp-bump')
var semver = require('semver');
var exec = require('child_process').exec;
var zip = require('gulp-zip');
var FtpDeploy = require('ftp-deploy');
var ftpDeploy = new FtpDeploy();
var appconfig = require('./appconfig.json');
var neoAsync = require('neo-async');

let args = {};
let baseDirectory = '../';


gulp.task('prepare-qa', (done) => {
    runSequence(
        'qa-select-branch',
        'git-clean',
        'git-checkout',
        'git-pull',
        'get-semantic-version',
        'git-add',
        'git-commit',
        'git-tag',
        'git-push',
        'git-push-tags',
        'build-files',
        'zip-files',
        'get-credentials',
        'get-qa-servers',
        'login-and-copy-to-servers',
        done);
});

gulp.task('qa-select-branch', (done) => {
    gulp.src(baseDirectory + 'package.json')
        .pipe(prompt.prompt({
            type: 'input',
            name: 'branchName',
            message: 'Enter the git branch to deploy from [development]'
        }, function (res) {
            console.log('Chosen branch is: ', res.branchName);
            args.branchName = res.branchName;
            done();
        }));
});

gulp.task('git-clean', (done) => {
    gulpGit.clean({ args: '-f' }, (err) => {
        if (err) return done(err);
        console.log('Cleaned the branch successfully');
        done();
    });
});

gulp.task('git-checkout', (done) => {
    gulpGit.checkout(args.branchName, (err) => {
        if (err) return done(err);
        console.log('Branch ', args.branchName + ' Checked Out successfully');
        done();
    });
});

gulp.task('git-pull', (done) => {
    gulpGit.pull('origin', args.branchName, { args: '--rebase' }, (err) => {
        if (err) return done(err);
        console.log('Branch ', args.branchName + ' pulled successfully from Origin');
        done();
    });
});

gulp.task('get-semantic-version', (done) => {
    var currentVersion = packageJson.version;
    console.log('Current Version: ', currentVersion);
    var newVersion = semver.inc(currentVersion, 'prerelease', 'qa');
    console.log('New Version: ', newVersion);
    args.newVersion = newVersion;
    gulp.src([baseDirectory + 'package.json'])
        .pipe(gulpBump({
            version: newVersion,
            type: 'prerelease'
        }))
        .pipe(gulp.dest(baseDirectory));
    done();
});

// gulp.task('gulp-bump', (done) => {
//     console.log('About to bump the version.');
//     gulp.src('./package.json')
//         .pipe(prompt.prompt({
//             type: 'input',
//             name: 'releaseType',
//             message: 'Is it a major/minor/patch release?'
//         }, (res) => {
//             args.releaseType = res.releaseType;
//             gulp.src('./package.json')
//                 .pipe(gulpBump({ type: args.releaseType }))
//                 .pipe(gulp.dest('./'));
//             done();
//         }));
// });

gulp.task('git-add', (done) => {
    console.log('Staging package.json');
    return gulp.src([baseDirectory + 'package.json'])
        .pipe(gulpGit.add());
});

gulp.task('git-commit', (done) => {
    console.log('Commiting package.json');
    return gulp.src([baseDirectory + 'package.json'])
        .pipe(gulpGit.commit('build(release): version upgraded to v' + args.newVersion));
});

gulp.task('git-tag', (done) => {
    gulpGit.tag('v' + args.newVersion, 'Tag created: ' + args.newVersion, (err) => {
        if (err) return done(err);
        console.log('Tagged the ' + args.branchName + ' branch with Version ' + args.newVersion);
        done();
    });
});

gulp.task('git-push', (done) => {
    console.log('Push commits to origin');
    gulpGit.push('origin', args.branchName, (err) => {
        if (err) return done(err);
        console.log('Pushed ' + args.branchName + ' to origin/' + args.branchName);
        done();
    });
});

gulp.task('git-push-tags', (done) => {
    console.log('Pushing all the tags from local to remote');
    gulpGit.exec({ args: 'push --tags' }, (err) => {
        if (err) return done(err);
        console.log('All tags pushed from local to remote');
        done();
    });
});

gulp.task('build-files', (done) => {
    exec('ng build --prod', (err, stdout, stderr) => {
        if (err) return done(err);
        done();
    });
});

// gulp.task('tar-and-zip', (done) => {
//     console.log('Zipping the target files');
//     exec('"./utils/7zip/7za.exe" a -ttar -so archive.tar rfframework | "../utils/7zip/7za.exe" a -si "output/rfframework.tgz"',
//     (err, stdout, stderr) => {
//       console.log(stdout);
//       console.log(stderr);
//       callback(err);
//     });
//   console.log(successFormat('Compressed the src files successfully!!!'));
// });

gulp.task('zip-files', (done) => {
    console.log('Zipping files..');
    gulp.src(baseDirectory + 'dist/*')
        .pipe(zip('buildFiles.zip'))
        .pipe(gulp.dest('./output'));
    console.log('Zipping complete.');
    done();
});

gulp.task('get-credentials', (done) => {
    gulp.src(baseDirectory + 'package.json')
        .pipe(prompt.prompt(
            [{
                type: 'input',
                name: 'username',
                message: 'Please enter the username: ',
                validate: (username) => {
                    if (username === '') return false;
                    else return true;
                }
            },
            {
                type: 'password',
                name: 'password',
                message: 'Please enter the password: ',
                validate: (password) => {
                    if (password === '') return false;
                    else return true;
                }
            }
            ], (res) => {
                args.username = 'ohl\\' + res.username;
                args.password = res.password;
                console.log('Username and Password obtained.');
                done();
            }));
    done();
});

gulp.task('get-qa-servers', (done) => {
    let serverList = [];
    for (let index = 0; index < appconfig.qa_servers.length; index++) {
        serverList.push(appconfig.qa_servers[index].ip + '(' + appconfig.qa_servers[index].name + ')');
    }
    gulp.src(baseDirectory + 'package.json')
        .pipe(prompt.prompt({
            type: 'checkbox',
            name: 'servers',
            message: 'Choose the QA servers for deployment: ',
            choices: serverList,
            validate: (servers) => {
                let serverList = servers || [];
                if (serverList.length === 0) return false;
                else return true;
            }
        }, function (res) {
            args.servers = res.servers;
            done();
        }));
    done();
});

var config = {
    user: "ohl\\aa-mfrancis",                   // NOTE that this was username in 1.x 
    password: "Geodis123",           // optional, prompted if none given
    host: "10.202.90.23",
    port: 21,
    localRoot: './output/',
    remoteRoot: 'dist',
    include: ['*'],
    exclude: [],
    deleteRoot: true
}

gulp.task('login-and-copy-to-servers', (done) => {
    neoAsync.eachSeries(args.servers, (server, done) => {
        let ftpConfig = {
            user: args.username,
            password: args.password,
            host: server,
            port: 21,
            localRoot: './output/',
            remoteRoot: 'dist',
            include: ['*'],
            exclude: [],
            deleteRoot: true
        };
        console.log('Copying files to ' + server + ' started');
        ftpDeploy.deploy(config, function (err) {
            if (err) console.log(err)
            else console.log('Copied files successfully to server ', server);
        });
        ftpDeploy.on('uploaded', function (data) {
            console.log('On Upload');
            console.log(data);  
        });
    }, (result) => {
        console.log('Copied files to all the servers!!!');
        done();
    });
});
