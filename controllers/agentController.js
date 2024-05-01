const e = require("express");
const tags = require("../public/assets/tag.js");
const jwt = require("jsonwebtoken");
const { httpRequest } = require('../utils/httpRequest.js');

// gcp bucket

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const GCP_KEYFILE_PATH = process.env.GCP_KEYFILE_PATH;
const GCP_BUCKET_NAME = process.env.GCP_BUCKET_NAME;

const {Storage} = require('@google-cloud/storage');

const storage = new Storage({
  projectId: GCP_PROJECT_ID,
  keyFilename: GCP_KEYFILE_PATH
});
const bucket = storage.bucket(GCP_BUCKET_NAME);

module.exports = {
    agentProfile: async (req, res, next) => {
        try {
            const response = {};
            // [start] agent 프로필 정보 가져오기
            const getProfileOptions = {
                host: 'stop_bang_auth_DB',
                port: process.env.MS_PORT,
                path: `/db/agent/findByRaRegno/${req.params.ra_regno}`,
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                }
              }
              httpRequest(getProfileOptions)
              .then((profileRes) => {
                const apiResponse = fetch(
                    `http://openapi.seoul.go.kr:8088/${process.env.API_KEY}/json/landBizInfo/1/1/${req.params.ra_regno}`
                  );
                const js = apiResponse.json();
                if (js.landBizInfo == undefined){
                    response.agent = null;
                    // response.agentMainInfo = null;
                }
                else{
                    response.agent = js.landBizInfo.row[0];
                    // response.agentMainInfo = js.landBizInfo.row[0];
                }
                if(profileRes.body.length){
                    response.agent += profileRes.body[0];
                    // response.agentMainInfo += profileRes.body[0];
                }
                else{
                    response.agent = null;
                    // response.agentMainInfo = null;
                }
                console.log(response.agent);
                // // [end] agent main info 가져오기 (생략해도 될듯)
                // const getMainInfoOptions = {
                //     host: 'stop_bang_auth_DB',
                //     port: process.env.MS_PORT,
                //     path: `/db/agent/findByRaRegno/${req.params.ra_regno}`,
                //     method: 'GET',
                //     headers: {
                //       'Content-Type': 'application/json',
                //     }
                //   }

              })
        // let agent = await agentModel.getAgentProfile(req.params.id);
        // let getMainInfo = await agentModel.getMainInfo(req.params.id);
        

        if (getMainInfo.a_username !== decoded.userId) // main으로 통신 보낼 때 확인 
            res.render('notFound.ejs', {message: "접근이 제한되었습니다. 공인중개사 계정으로 로그인하세요"});
        // let getEnteredAgent = await agentModel.getEnteredAgent(req.params.id);
        let getReviews = await agentModel.getReviewByRaRegno(req.params.id);
        let getReport = await agentModel.getReport(req.params.id, decoded.userId);
        let getRating = await agentModel.getRating(req.params.id);
        let statistics = makeStatistics(getReviews);
        // res.locals.agent = agent[0];
        // res.locals.agentMainInfo = getMainInfo;
        // res.locals.agentSubInfo = getEnteredAgent[0][0];
        res.locals.agentReviewData = getReviews;
        res.locals.report = getReport;
        res.locals.statistics = statistics;

        if (getRating === null) {
            res.locals.agentRating = 0;
            res.locals.tagsData = null;
        } else {
            res.locals.agentRating = getRating;
            res.locals.tagsData = tags.tags;
        }

        /* gcs */
        const profileImage = response.a_profile_image;
        if(profileImage !== null) {
            response.a_profile_image = bucket.file(`agent/${profileImage}`).publicUrl();
            // res.locals.agent.a_profile_image = bucket.file(`agent/${profileImage}`).publicUrl();
        }
        } catch (err) {
        console.error(err.stack);
        }
        next();
    },

    updateMainInfo: async (req, res) => {
        let getMainInfo = await agentModel.getMainInfo(req.params.id);

        let image1 = getMainInfo.a_image1;
        let image2 = getMainInfo.a_image2;
        let image3 = getMainInfo.a_image3;
        let introduction = getMainInfo.a_introduction;
        
        let title = `소개글 수정하기`;
        res.render("agent/updateMainInfo.ejs", {
            title: title,
            agentId: req.params.id,
            image1: image1,
            image2: image2,
            image3: image3,
            introduction: introduction,
        });
    },

    updatingMainInfo: (req, res, next) => {
        agentModel.updateMainInfo(req.params.id, req.files, req.body, () => {
        if (res === null) {
            if (error === "imageError") {
            res.render('notFound.ejs', {message: "이미지 크기가 너무 큽니다. 다른 사이즈로 시도해주세요."})
            }
        } else {
            res.locals.redirect = `/agent/${req.params.id}`;
            next();
        }
        });
    },

    updateEnteredInfo: async (req, res) => {
        let getEnteredAgent = await agentModel.getEnteredAgent(req.params.id);

        let profileImage = getEnteredAgent[0][0].a_profile_image;
        console.log(getEnteredAgent[0]);
        let officeHour = getEnteredAgent[0][0].a_office_hours;
        let hours = officeHour != null ? officeHour.split(' ') : null;

        let title = `부동산 정보 수정하기`;
        res.render("agent/updateAgentInfo.ejs", {
        title: title,
        agentId: req.params.id,
        profileImage: profileImage,
        officeHourS: hours != null ? hours[0] : null,
        officeHourE: hours != null ? hours[2] : null
        });
    },

    updatingEnteredInfo: (req, res, next) => {
        try {
        let filename = '';
        /* gcs */
        if(req.file) {
            const date = new Date();
            const fileTime = date.getTime();
            filename = `${fileTime}-${req.file.originalname}`;
            const gcsFileDir = `agent/${filename}`;
            // gcs에 agent 폴더 밑에 파일이 저장
            const blob = bucket.file(gcsFileDir);
            const blobStream = blob.createWriteStream();

            blobStream.on('finish', () => {
            console.log('gcs upload successed');
            });

            blobStream.on('error', (err) => {
            console.log(err);
            });

            blobStream.end(req.file.buffer);
        }
        req.file.filename = filename;
        agentModel.updateEnterdAgentInfo(req.params.id, req.file, req.body, () => {
            res.redirect(`/agent/${req.params.id}`);
        });
        } catch(err) {
        console.log('updating info err : ', err);
        }
    }
}