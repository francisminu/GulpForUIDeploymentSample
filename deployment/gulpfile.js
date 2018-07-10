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
var colors = require('colors');
var CLIOptions = require('@angular/cli');

let args = {};
let baseDirectory = '../';

var infoLog = colors.green;
var debugLog = colors.white;
var warningLog = colors.yellow;
var errorLog = colors.red;
var userInput = colors.cyan;


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
    args.currentDeploymentEnv = 'qa';
    gulp.src(baseDirectory + 'package.json')
        .pipe(prompt.prompt({
            type: 'input',
            name: 'branchName',
            message: userInput('Enter the git branch to deploy from [development]')
        }, function (res) {
            console.log(infoLog('Chosen branch is: ', res.branchName));
            args.branchName = res.branchName;
            done();
        }));
});

gulp.task('git-clean', (done) => {
    gulpGit.clean({ args: '-f' }, (err) => {
        if (err) {
            console.log(errorLog('git-clean failed ', err));
            return done(err);
        }
        console.log(infoLog('Cleaned the branch successfully'));
        done();
    });
});

gulp.task('git-checkout', (done) => {
    gulpGit.checkout(args.branchName, (err) => {
        if (err) {
            console.log(errorLog('git-checkout failed.'));
            return done(err);
        }
        console.log(infoLog('Branch ', args.branchName + ' Checked Out successfully'));
        done();
    });
});

gulp.task('git-pull', (done) => {
    gulpGit.pull('origin', args.branchName, { args: '--rebase' }, (err) => {
        if (err) {
            console.log(errorLog('git-pull failed'));
            return done(err);
        }
        console.log(infoLog('Branch ', args.branchName + ' pulled successfully from Origin'));
        done();
    });
});

gulp.task('get-semantic-version', (done) => {
    var currentVersion = packageJson.version;
    console.log(infoLog('Current Version: ', currentVersion));
    var newVersion = semver.inc(currentVersion, 'prerelease', 'qa');
    console.log(infoLog('New Version: ', newVersion));
    args.newVersion = newVersion;
    gulp.src([baseDirectory + 'package.json'])
        .pipe(gulpBump({
            version: newVersion,
            type: 'prerelease'
        }))
        .pipe(gulp.dest(baseDirectory));
    done();
});

gulp.task('git-add', (done) => {
    console.log(infoLog('Staging package.json'));
    return gulp.src([baseDirectory + 'package.json'])
        .pipe(gulpGit.add());
});

gulp.task('git-commit', (done) => {
    console.log(infoLog('Commiting package.json'));
    return gulp.src([baseDirectory + 'package.json'])
        .pipe(gulpGit.commit('build(release): version upgraded to v' + args.newVersion));
});

gulp.task('git-tag', (done) => {
    gulpGit.tag('v' + args.newVersion, 'Tag created: ' + args.newVersion, (err) => {
        if (err) {
            console.log(errorLog('git-tag failed'));
            return done(err);
        }
        console.log(infoLog('Tagged the ' + args.branchName + ' branch with Version ' + args.newVersion));
        done();
    });
});

gulp.task('git-push', (done) => {
    console.log(infoLog('Push commits to origin'));
    gulpGit.push('origin', args.branchName, (err) => {
        if (err) {
            console.log(errorLog('git-push failed'));
            return done(err);
        }
        console.log(infoLog('Pushed ' + args.branchName + ' to origin/' + args.branchName));
        done();
    });
});

gulp.task('git-push-tags', (done) => {
    console.log(infoLog('Pushing all the tags from local to remote'));
    gulpGit.exec({ args: 'push --tags' }, (err) => {
        if (err) {
            console.log(errorLog('git-push-tags failed'));
            return done(err);
        }
        console.log(infoLog('All tags pushed from local to remote'));
        done();
    });
});

gulp.task('build-files', (done) => {
    exec('ng build --args.currentDeploymentEnv', (err, stdout, stderr) => {
        if (err) {
            console.log(errorLog('build-files failed. Error: ', err));
            return done(err);
        }
        done();
    });
});

gulp.task('zip-files', (done) => {
    console.log(infoLog('Zipping files..'));
    gulp.src(baseDirectory + 'dist/*')
        .pipe(zip('buildFiles.zip'))
        .pipe(gulp.dest('./output'));
    console.log(infoLog('Zipping complete.'));
    done();
});

gulp.task('get-credentials', (done) => {
    gulp.src(baseDirectory + 'package.json')
        .pipe(prompt.prompt(
            [{
                type: 'input',
                name: 'username',
                message: userInput('Please enter the username: '),
                validate: (username) => {
                    if (username === '') return false;
                    else return true;
                }
            },
            {
                type: 'password',
                name: 'password',
                message: userInput('Please enter the password: '),
                validate: (password) => {
                    if (password === '') return false;
                    else return true;
                }
            }
            ], (res) => {
                args.username = 'ohl\\' + res.username;
                args.password = res.password;
                console.log(infoLog('Username and Password obtained.'));
                done();
            }));
});

gulp.task('get-qa-servers', (done) => {
    console.log(infoLog('Fetching QA Servers...'));
    let serverList = [];
    for (let index = 0; index < appconfig.qa_servers.length; index++) {
        serverList.push(appconfig.qa_servers[index].ip + '(' + appconfig.qa_servers[index].name + ')');
    }
    gulp.src(baseDirectory + 'package.json')
        .pipe(prompt.prompt({
            type: 'checkbox',
            name: 'servers',
            message: userInput('Choose the QA servers for deployment: '),
            choices: serverList,
            validate: (servers) => {
                let serverList = servers || [];
                if (serverList.length === 0) return false;
                else return true;
            }
        }, function (res) {
            args.servers = res.servers;
            console.log(infoLog('QA Servers are: ', args.servers));
            done();
        }));
});

gulp.task('login-and-copy-to-servers', (done) => {
    neoAsync.eachSeries(args.servers, (server, done) => {
        let ftpConfig = {
            user: args.username,
            password: args.password,
            host: server.split('(')[0],
            port: 21,
            localRoot: './output/',
            remoteRoot: 'deployment/output',
            include: ['*'],
            exclude: [],
            deleteRoot: true
        };
        console.log(infoLog('Copying files to ' + server + ' started'));
        ftpDeploy.deploy(ftpConfig, (err) => {
            if (err) {
                console.log(errorLog('login-and-copy-to-servers failed. Error: ', err));
                return done(err);
            }
            done();
        });
        ftpDeploy.on('uploaded', function (data) {
            console.log(infoLog('Uploaded the files'));
        });
    }, (result) => {
        console.log(infoLog('Copied files to all the servers!!!'));
        done();
    });
});

// gulp.task('get-config', () => {
//     let env = CLIOptions.getEnvironment();
//     console.log('Evn is: ', env);
// });
