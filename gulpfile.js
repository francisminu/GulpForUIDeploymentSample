var gulp = require('gulp');
var runSequence = require('run-sequence');
var packageJson = require('./package.json');
var prompt = require('gulp-prompt');
var gulpGit = require('gulp-git');
var gulpBump = require('gulp-bump')
var semver = require('semver');

let args = {};
let baseDirectory = './';

gulp.task('prepare-qa', (done) => {
    runSequence(
        // 'qa-select-branch',
        // 'git-clean',
        // 'git-checkout',
        // 'git-pull',
        'get-semantic-version',
        // 'gulp-bump',
        done);
});

gulp.task('qa-select-branch', (done) => {
    gulp.src('./package.json')
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
    gulp.src(['package.json'])
        .pipe(gulpBump({
            version: newVersion,
            type: 'prerelease'
        }))
        .pipe(gulp.dest('./'));
        done();
});

gulp.task('gulp-bump', (done) => {
    console.log('About to bump the version.');
    gulp.src('./package.json')
        .pipe(prompt.prompt({
            type: 'input',
            name: 'releaseType',
            message: 'Is it a major/minor/patch release?'
        }, (res) => {
            args.releaseType = res.releaseType;
            gulp.src('./package.json')
                .pipe(gulpBump({ type: args.releaseType }))
                .pipe(gulp.dest('./'));
            done();
        }));
});