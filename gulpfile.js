var gulp = require('gulp');
var runSequence = require('run-sequence');
var packageJson = require('./package.json');
var prompt = require('gulp-prompt');
var gulpGit = require('gulp-git');

let args = {};
let baseDirectory = './';

gulp.task('prepare-qa', (done) => {
    runSequence('qa-select-branch',
        'git-clean',
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
 
// Why is a path given there?
gulp.task('git-clean', (done) => {
    gulpGit.clean({ cwd:baseDirectory, args: '-f' }, (err) => {
        if (err) return done(err);
        console.log('Cleaned the branch successfully');
        done();
    });
});