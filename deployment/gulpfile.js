var gulp = require('gulp');
var runSequence = require('run-sequence');
var packageJson = require('../package.json');
var prompt = require('gulp-prompt');
var gulpGit = require('gulp-git');
var gulpBump = require('gulp-bump')
var semver = require('semver');
var exec = require('child_process').exec;

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
        .pipe(gulp.dest('./'));
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
        .pipe(gulpGit.commit('build(release): version upgraded to ' + args.newVersion));
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
        if(err) return done(err);
        done();
    });
});